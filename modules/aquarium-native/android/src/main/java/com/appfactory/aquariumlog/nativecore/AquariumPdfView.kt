package com.appfactory.aquariumlog.nativecore

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.util.LruCache
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.widget.OverScroller
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.roundToInt

/** Scrolls and zooms the same PDF surface. Original files never leave the vault. */
class AquariumPdfView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private var store: PdfPreviewStore? = null
    private var session = ""
    @Volatile private var generation = 0
    private var attached = false
    private var sizes = emptyList<Pair<Int, Int>>()
    private var pages = emptyList<RectF>()
    private var contentHeight = 0f
    private var zoom = 1f
    private var offsetX = 0f
    private var offsetY = 0f
    private val gap = 8f * resources.displayMetrics.density
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private var error = false
    private var loading = false
    private val pending = mutableSetOf<String>()
    private val cache = object : LruCache<String, Bitmap>(32 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
        override fun entryRemoved(evicted: Boolean, key: String, oldValue: Bitmap, newValue: Bitmap?) {
            if (oldValue !== newValue) oldValue.recycle()
        }
    }
    private val scroller = OverScroller(context)
    private val scaleDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
            scroller.forceFinished(true)
            parent?.requestDisallowInterceptTouchEvent(true)
            return true
        }
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            scaleTo((zoom * detector.scaleFactor).coerceIn(1f, 5f), detector.focusX, detector.focusY)
            return true
        }
    })
    private val gestures = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onDown(event: MotionEvent): Boolean {
            scroller.forceFinished(true)
            return true
        }
        override fun onScroll(first: MotionEvent?, current: MotionEvent, distanceX: Float, distanceY: Float): Boolean {
            if (!scaleDetector.isInProgress) {
                offsetX += distanceX
                offsetY += distanceY
                clampOffsets()
                invalidate()
            }
            return true
        }
        override fun onDoubleTap(event: MotionEvent): Boolean {
            scaleTo(if (zoom > 1.05f) 1f else 2f, event.x, event.y)
            return true
        }
        override fun onSingleTapConfirmed(event: MotionEvent): Boolean {
            performClick()
            return true
        }
        override fun onFling(first: MotionEvent?, current: MotionEvent, velocityX: Float, velocityY: Float): Boolean {
            if (!scaleDetector.isInProgress) {
                scroller.fling(offsetX.roundToInt(), offsetY.roundToInt(), -velocityX.roundToInt(), -velocityY.roundToInt(), 0, maxX().roundToInt(), 0, maxY().roundToInt())
                postInvalidateOnAnimation()
            }
            return true
        }
    })
    init {
        setWillNotDraw(false)
        isFocusable = true
        contentDescription = "PDF. Mit zwei Fingern vergrößern und zum Blättern wischen."
    }
    fun open(previews: PdfPreviewStore, id: String) {
        if (session == id && store === previews) return
        generation++
        session = id
        store = previews
        sizes = emptyList()
        pages = emptyList()
        zoom = 1f
        offsetX = 0f
        offsetY = 0f
        error = false
        cache.evictAll()
        pending.clear()
        loadSizes()
    }
    private fun loadSizes() {
        val previews = store ?: return
        if (session.isEmpty() || loading) return
        val token = generation
        val id = session
        loading = true
        executor.execute {
            val result = runCatching { previews.dimensions(id) }
            post {
                loading = false
                if (token != generation || session != id) {
                    if (attached && sizes.isEmpty()) loadSizes()
                    return@post
                }
                result.onSuccess { sizes = it; layoutPages() }.onFailure { error = true }
                invalidate()
            }
        }
    }
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        attached = true
        if (sizes.isEmpty()) loadSizes()
        invalidate()
    }
    override fun onDetachedFromWindow() {
        attached = false
        generation++
        scroller.forceFinished(true)
        cache.evictAll()
        pending.clear()
        super.onDetachedFromWindow()
    }
    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (oldw > 0) {
            offsetX *= w.toFloat() / oldw
            offsetY *= w.toFloat() / oldw
        }
        layoutPages()
    }
    private fun layoutPages() {
        var top = gap
        val pageWidth = max(1f, width - 2f * gap)
        pages = sizes.map { (w, h) ->
            RectF(gap, top, gap + pageWidth, top + pageWidth * h / w).also { top = it.bottom + gap }
        }
        contentHeight = top
        clampOffsets()
    }
    private fun maxX() = max(0f, width * zoom - width)
    private fun maxY() = max(0f, contentHeight * zoom - height)
    private fun clampOffsets() {
        offsetX = offsetX.coerceIn(0f, maxX())
        offsetY = offsetY.coerceIn(0f, maxY())
    }
    private fun scaleTo(next: Float, focusX: Float, focusY: Float) {
        offsetX = (offsetX + focusX) * next / zoom - focusX
        offsetY = (offsetY + focusY) * next / zoom - focusY
        zoom = next
        clampOffsets()
        invalidate()
    }
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.actionMasked == MotionEvent.ACTION_DOWN) parent?.requestDisallowInterceptTouchEvent(true)
        scaleDetector.onTouchEvent(event)
        gestures.onTouchEvent(event)
        if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) {
            parent?.requestDisallowInterceptTouchEvent(false)
            invalidate()
        }
        return true
    }
    override fun performClick(): Boolean {
        super.performClick()
        if (error) { error = false; if (sizes.isEmpty()) loadSizes(); invalidate() }
        return true
    }
    override fun computeScroll() {
        if (scroller.computeScrollOffset()) {
            offsetX = scroller.currX.toFloat()
            offsetY = scroller.currY.toFloat()
            clampOffsets()
            postInvalidateOnAnimation()
        }
    }
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (pages.isEmpty() || error) {
            paint.color = Color.GRAY
            paint.textSize = 14f * resources.displayMetrics.scaledDensity
            paint.textAlign = Paint.Align.CENTER
            canvas.drawText(if (error) "PDF nicht darstellbar. Zum Wiederholen tippen." else "PDF wird geladen …", width / 2f, height / 2f, paint)
            return
        }
        canvas.save()
        canvas.translate(-offsetX, -offsetY)
        canvas.scale(zoom, zoom)
        val firstY = offsetY / zoom
        val lastY = (offsetY + height) / zoom
        pages.forEachIndexed { index, rect ->
            if (rect.bottom < firstY || rect.top > lastY) return@forEachIndexed
            paint.color = Color.WHITE
            canvas.drawRect(rect, paint)
            val resolution = ((rect.width() * zoom / 256f).toInt() + 1).times(256).coerceIn(256, 2048)
            val key = "$index-$resolution"
            val bitmap = cache.get(key) ?: cache.snapshot().entries.lastOrNull { it.key.startsWith("$index-") }?.value
            if (bitmap != null) canvas.drawBitmap(bitmap, null, rect, paint)
            if (cache.get(key) == null && !error) requestPage(index, resolution, key)
        }
        canvas.restore()
    }
    private fun requestPage(index: Int, resolution: Int, key: String) {
        val previews = store ?: return
        if (!attached || !pending.add(key)) return
        val token = generation
        val id = session
        executor.execute {
            if (token != generation) return@execute
            val result = runCatching {
                val path = requireNotNull(Uri.parse(previews.render(id, index, resolution)).path)
                requireNotNull(BitmapFactory.decodeFile(path))
            }
            post {
                if (token != generation || !attached) { result.getOrNull()?.recycle(); return@post }
                pending.remove(key)
                result.onSuccess { cache.put(key, it) }.onFailure { error = true }
                invalidate()
            }
        }
    }
    companion object {
        private val executor = Executors.newSingleThreadExecutor()
    }
}
