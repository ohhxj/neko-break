import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct Bitmap {
    let width: Int
    let height: Int
    var pixels: [UInt8]
}

func loadBitmap(at path: String) throws -> Bitmap {
    let url = URL(fileURLWithPath: path) as CFURL
    guard
        let source = CGImageSourceCreateWithURL(url, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        throw NSError(domain: "IconAlphaRepair", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Unable to read image at \(path)"
        ])
    }

    let width = image.width
    let height = image.height
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    guard let context = CGContext(
        data: &pixels,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        throw NSError(domain: "IconAlphaRepair", code: 2, userInfo: [
            NSLocalizedDescriptionKey: "Unable to create image context"
        ])
    }

    context.interpolationQuality = .high
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return Bitmap(width: width, height: height, pixels: pixels)
}

func writeBitmap(_ bitmap: Bitmap, to path: String) throws {
    let data = Data(bitmap.pixels) as CFData
    guard
        let provider = CGDataProvider(data: data),
        let image = CGImage(
            width: bitmap.width,
            height: bitmap.height,
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            bytesPerRow: bitmap.width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider,
            decode: nil,
            shouldInterpolate: true,
            intent: .defaultIntent
        )
    else {
        throw NSError(domain: "IconAlphaRepair", code: 3, userInfo: [
            NSLocalizedDescriptionKey: "Unable to create output image"
        ])
    }

    let url = URL(fileURLWithPath: path) as CFURL
    guard let destination = CGImageDestinationCreateWithURL(url, UTType.png.identifier as CFString, 1, nil) else {
        throw NSError(domain: "IconAlphaRepair", code: 4, userInfo: [
            NSLocalizedDescriptionKey: "Unable to create PNG destination"
        ])
    }

    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw NSError(domain: "IconAlphaRepair", code: 5, userInfo: [
            NSLocalizedDescriptionKey: "Unable to write PNG"
        ])
    }
}

guard CommandLine.arguments.count == 4 else {
    fputs("usage: repair_icon_alpha.swift color.png broken-alpha.png output.png\n", stderr)
    exit(64)
}

let color = try loadBitmap(at: CommandLine.arguments[1])
let alpha = try loadBitmap(at: CommandLine.arguments[2])
guard color.width == alpha.width, color.height == alpha.height else {
    fputs("input dimensions do not match\n", stderr)
    exit(65)
}

let width = color.width
let height = color.height
let count = width * height

func alphaValue(_ index: Int) -> UInt8 {
    alpha.pixels[index * 4 + 3]
}

var rowBounds = [(left: Int, right: Int)?](repeating: nil, count: height)
for y in 0..<height {
    var left: Int?
    var right: Int?
    for x in 0..<width where alphaValue(y * width + x) > 8 {
        left = left ?? x
        right = x
    }
    if let left, let right {
        rowBounds[y] = (left, right)
    }
}

var output = color
for index in 0..<count {
    let x = index % width
    let y = index / width
    let bounds = rowBounds[y]
    let newAlpha: UInt8
    if let bounds, x > bounds.left, x < bounds.right {
        newAlpha = 255
    } else {
        newAlpha = alphaValue(index)
    }
    let pixel = index * 4
    output.pixels[pixel] = UInt8((UInt16(color.pixels[pixel]) * UInt16(newAlpha)) / 255)
    output.pixels[pixel + 1] = UInt8((UInt16(color.pixels[pixel + 1]) * UInt16(newAlpha)) / 255)
    output.pixels[pixel + 2] = UInt8((UInt16(color.pixels[pixel + 2]) * UInt16(newAlpha)) / 255)
    output.pixels[pixel + 3] = newAlpha
}

try writeBitmap(output, to: CommandLine.arguments[3])
