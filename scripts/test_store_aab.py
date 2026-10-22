"""Release checks for offline permissions and native page alignment."""

import struct
import unittest
import xml.etree.ElementTree as ET

from verify_store_aab import ANDROID, verify_elf, verify_network_permissions


class NetworkPermissionsTest(unittest.TestCase):
    def manifest(self, name=None, tag="uses-permission"):
        root = ET.Element("manifest")
        if name:
            ET.SubElement(root, tag, {ANDROID + "name": name})
        return root

    def test_local_permissions_are_allowed(self):
        permission = "android.permission.CAMERA"
        self.assertEqual(
            verify_network_permissions(self.manifest(permission)),
            {permission},
        )

    def test_manifest_without_permissions_is_allowed(self):
        self.assertEqual(verify_network_permissions(self.manifest()), set())

    def test_internet_permission_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "network permissions"):
            verify_network_permissions(
                self.manifest("android.permission.INTERNET")
            )

    def test_network_state_permission_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "network permissions"):
            verify_network_permissions(
                self.manifest("android.permission.ACCESS_NETWORK_STATE")
            )

    def test_sdk_23_permission_is_also_rejected(self):
        with self.assertRaisesRegex(ValueError, "network permissions"):
            verify_network_permissions(
                self.manifest(
                    "android.permission.INTERNET", "uses-permission-sdk-23"
                )
            )


class NativeAlignmentTest(unittest.TestCase):
    def elf(self, alignment, file_offset=0, address=0):
        data = bytearray(120)
        data[:6] = b"\x7fELF\x02\x01"
        struct.pack_into("<Q", data, 32, 64)
        struct.pack_into("<HH", data, 54, 56, 1)
        struct.pack_into(
            "<IIQQQQQQ", data, 64, 1, 5, file_offset, address, 0, 0, 0, alignment
        )
        return data

    def test_16_kb_load_segment_is_allowed(self):
        verify_elf(self.elf(16384), "valid.so")

    def test_4_kb_load_segment_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "16 KB"):
            verify_elf(self.elf(4096), "old.so")

    def test_zero_alignment_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "16 KB"):
            verify_elf(self.elf(0), "invalid.so")

    def test_inconsistent_load_offsets_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "16 KB"):
            verify_elf(self.elf(16384, file_offset=4096), "invalid.so")
