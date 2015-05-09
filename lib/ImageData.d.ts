/// <reference path="UInt8ClampedArray" />

interface ImageDataConstructor {
    new(): ImageData;
    new(data: Uint8ClampedArray, width: number, height: number): ImageData;
    
    prototype: ImageData;
}
