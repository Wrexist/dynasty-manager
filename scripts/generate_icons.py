#!/usr/bin/env python3
"""
Dynasty Manager — App Icon Generator
Usage: python3 scripts/generate_icons.py <source-image.png>
Generates all required icon sizes for iOS, Android, and PWA.
"""
import sys
import os
from pathlib import Path
from PIL import Image

PROJECT_ROOT = Path(__file__).parent.parent

SIZES = {
    # iOS — single universal 1024x1024
    "ios": [
        (PROJECT_ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", 1024),
    ],

    # Android legacy launcher icons
    "android_legacy": [
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-mdpi/ic_launcher.png",    48),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png", 48),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-hdpi/ic_launcher.png",    72),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png", 72),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-xhdpi/ic_launcher.png",   96),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png", 96),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png",  144),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png", 144),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png", 192),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png", 192),
    ],

    # Android adaptive icon foreground (108dp canvas — icon fills inner 72dp)
    "android_foreground": [
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png",    108),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png",    162),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png",   216),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png",  324),
        (PROJECT_ROOT / "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png", 432),
    ],

    # PWA / web
    "web": [
        (PROJECT_ROOT / "public/icon.png",         512),
        (PROJECT_ROOT / "public/icon-384.png",     384),
        (PROJECT_ROOT / "public/icon-192.png",     192),
        (PROJECT_ROOT / "public/icon-maskable.png", 512),
        (PROJECT_ROOT / "public/logo.png",         512),
        (PROJECT_ROOT / "public/favicon.ico",       32),  # handled specially
    ],
}


def make_icon(img: Image.Image, size: int, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    resized = img.resize((size, size), Image.LANCZOS)
    if dest.suffix == ".ico":
        resized.save(dest, format="ICO", sizes=[(32, 32), (16, 16)])
    else:
        resized.save(dest, format="PNG", optimize=True)
    print(f"  ✓  {dest.relative_to(PROJECT_ROOT)}  ({size}x{size})")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/generate_icons.py <source-image.png>")
        sys.exit(1)

    src_path = Path(sys.argv[1])
    if not src_path.exists():
        print(f"Error: source image not found: {src_path}")
        sys.exit(1)

    print(f"\nDynasty Manager — Icon Generator")
    print(f"Source: {src_path}\n")

    img = Image.open(src_path).convert("RGBA")
    print(f"Source size: {img.width}x{img.height}")

    print("\n[iOS]")
    for dest, size in SIZES["ios"]:
        make_icon(img, size, dest)

    print("\n[Android — legacy launchers]")
    for dest, size in SIZES["android_legacy"]:
        make_icon(img, size, dest)

    print("\n[Android — adaptive foreground]")
    for dest, size in SIZES["android_foreground"]:
        make_icon(img, size, dest)

    print("\n[Web / PWA]")
    for dest, size in SIZES["web"]:
        make_icon(img, size, dest)

    print("\nAll icons generated successfully.")


if __name__ == "__main__":
    main()
