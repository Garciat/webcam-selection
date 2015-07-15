/// <reference path="../typings/webrtc/MediaStream.d.ts" />
/// <reference path="../lib/UInt8ClampedArray.d.ts" />
/// <reference path="../lib/ImageData.d.ts" />

// https://github.com/Microsoft/TypeScript/issues/949
const ImageDataFixed: ImageDataConstructor = <any> ImageData;

module ArrayHelper {
    export function coerce<T>(obj: ArrayLike<T>): T[] {
        return Array.prototype.slice.apply(obj);
    }
}

module Selector {
    export function all(element: Element, query: string): HTMLElement[] {
        return <HTMLElement[]> ArrayHelper.coerce(element.querySelectorAll(query));
    }
}

module VideoHelper {
    export function getFrameCount(video: HTMLVideoElement): number {
        return (<any> video).webkitDecodedFrameCount;
    }
}

class BoundingBox {
    constructor(public topX: number, public topY: number, public botX: number, public botY: number) {

    }

    getArea() {
        var w = this.botX - this.topX;
        var h = this.botY - this.topY;
        return w * h;
    }
}

module BoundingBox {
    export function fromElement(child: HTMLElement) {
        var x = child.offsetLeft;
        var y = child.offsetTop;
        var w = child.clientWidth;
        var h = child.clientHeight;

        return new BoundingBox(x, y, x + w, y + h);
    }
}

interface HTMLTemplateElement extends HTMLElement {
    content: DocumentFragment;
}

class MotionDetector {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private lastData: Uint8ClampedArray = null;
    private processed: Uint8ClampedArray;

    constructor(private video: HTMLVideoElement, private threshold: number, private flip?: boolean, private debug?: boolean) {
        this.video = video;

        this.canvas = document.createElement('canvas');
        this.canvas.width = video.clientWidth;
        this.canvas.height = video.clientHeight;

        this.ctx = <CanvasRenderingContext2D> this.canvas.getContext('2d');

        this.processed = this.capture();
        //this.processed.fill(0);
    }

    private capture(): Uint8ClampedArray {
        this.ctx.drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight, 0, 0, this.canvas.width, this.canvas.height);
        var imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        var data = <Uint8ClampedArray> <any> imageData.data; // TypeScript bug #949
        return data;
    }

    process() {
        if (this.lastData === null) {
            this.lastData = this.capture();
            return;
        }

        var a1 = this.lastData;
        var a2 = this.capture();

        var p = this.processed;
        var t = this.threshold;

        for (var i = 0; i < a1.length; i += 4) {
            var d0 = (a1[i + 0] - a2[i + 0]) | 0;
            var d1 = (a1[i + 1] - a2[i + 1]) | 0;
            var d2 = (a1[i + 2] - a2[i + 2]) | 0;

            var x0 = (d0 ^ (d0 >> 31)) - (d0 >> 31);
            var x1 = (d1 ^ (d1 >> 31)) - (d1 >> 31);
            var x2 = (d2 ^ (d2 >> 31)) - (d2 >> 31);

            var y = x0 | x1 | x2;

            var z = y > t ? 0xFF : 0x00;

            p[i + 0] = z;
            p[i + 1] = z;
            p[i + 2] = z;
            p[i + 3] = 0xFF;
        }

        this.lastData = a2;
    }

    query(threshold: number, box: BoundingBox): boolean {
        var cw = this.canvas.width;
        var p = this.processed;

        var x1 = box.topX;
        var y1 = box.topY;
        var x2 = box.botX;
        var y2 = box.botY;
        
        if (this.flip) {
            var d = this.canvas.width - x2 - x1;
            x1 += d;
            x2 += d;
        }

        var n = 0;

        for (var i = y1; i < y2; ++i) {
            for (var j = x1; j < x2; ++j) {
                var k = i * cw + j;
                n += p[k << 2] === 0xFF ? 1 : 0;
            }
        }

        if (this.debug && n >= threshold) {
            for (var i = y1; i < y2; ++i) {
                for (var j = x1; j < x2; ++j) {
                    var k = i * this.canvas.width + j;
                    var m = k * 4;
                    p[m + 0] = 0;
                    p[m + 1] = 0xFF;
                    p[m + 2] = 0;
                }
            }
        }

        return n >= threshold;
    }

    putDebugData(ctx: CanvasRenderingContext2D) {
        var imageData = new ImageDataFixed(this.processed, this.canvas.width, this.canvas.height);
        ctx.putImageData(imageData, 0, 0);
    }
}

interface CollisionItem {
    box: BoundingBox;
    threshold: number;
    callback: () => void;
}

class BoxCollisionDetector {
    private listeners: CollisionItem[] = [];

    constructor(private md: MotionDetector) {

    }

    register(cb: CollisionItem) {
        this.listeners.push(cb);
    }

    detect() {
        for (var item of this.listeners) {
            if (this.md.query(item.threshold, item.box)) {
                item.callback();
            }
        }
    }
}

class WebcamDisplay {
    private root: HTMLElement;
    private video: HTMLVideoElement;

    onReady = () => {};

    constructor() {
        this.root = WebcamDisplay.createRoot();
        this.video = WebcamDisplay.createVideoElement(this.root);
    }

    start(parent: Element) {
        parent.appendChild(this.root);

        navigator.webkitGetUserMedia(
            { video: true, audio: false },
            this.acceptStream,
            err => {}
        );
    }

    getRoot() {
        return this.root;
    }

    getVideo() {
        return this.video;
    }

    acceptStream = (stream: MediaStream) => {
        this.video.src = URL.createObjectURL(stream);
        this.video.onloadedmetadata = this.handleStreamStart;
        this.video.play();
    }

    handleStreamStart = () => {
        this.onReady();
    }

    private static createRoot() {
        var root = document.createElement('div');
        root.classList.add('webcam-display');
        return root;
    }

    private static createVideoElement(parent: Element) {
        var video = document.createElement('video');
        parent.appendChild(video);
        return video;
    }
}

class WebcamSelectionAdapter {
    private md: MotionDetector;
    private bcd: BoxCollisionDetector;

    private root: HTMLElement;
    private video: HTMLVideoElement;

    private debugCanvasA: HTMLCanvasElement = null;
    private debugCtxA: CanvasRenderingContext2D = null;

    onSelected = (source: HTMLElement) => {};

    constructor(private webcam: WebcamDisplay, private flip?: boolean, private debug?: boolean) {
        this.root = WebcamSelectionAdapter.createRoot();

        this.video = webcam.getVideo();
        this.md = new MotionDetector(this.video, 50, flip, debug);
        this.bcd = new BoxCollisionDetector(this.md);
        
        if (flip) {
            var vendors = ['', '-webkit-', '-moz-'];
            var transformStyle = vendors.map(s => s + 'transform: rotateY(180deg);').join('');
            this.video.setAttribute('style', transformStyle);
        }

        if (debug)
            this.initDebug();

        this.frameWorker();

        webcam.getRoot().appendChild(this.root);
    }

    addButton(x: number, y: number, button: HTMLElement, threshold: number) {
        button.style.left = x + 'px';
        button.style.top = y + 'px';

        this.root.appendChild(button);

        var box = BoundingBox.fromElement(button);

        this.bcd.register({
            box: box,
            threshold: box.getArea() * threshold,
            callback: () => this.onSelected(button)
        });
    }
    
    loadTemplate(template: HTMLTemplateElement) {
        var instance = <Element> document.importNode(template.content, true);
        var buttons = Selector.all(instance, 'button');

        for (var button of buttons) {
            let x = parseInt(button.getAttribute('data-x'), 10);
            let y = parseInt(button.getAttribute('data-y'), 10);
            let id = parseInt(button.getAttribute('data-id'), 10);

            this.addButton(x, y, button, 0.05);
        }
    }

    lastFrameCount = 0;

    frameWorker = () => {
        var frameCount = VideoHelper.getFrameCount(this.video);

        if (frameCount !== this.lastFrameCount) {
            this.md.process();
            this.bcd.detect();

            if (this.debug)
                this.md.putDebugData(this.debugCtxA);
        }

        this.lastFrameCount = frameCount;

        requestAnimationFrame(this.frameWorker);
    }

    private initDebug() {
        this.debugCanvasA = document.createElement('canvas');
        this.debugCanvasA.width = this.video.clientWidth;
        this.debugCanvasA.height = this.video.clientHeight;
        
        var vendors = ['', '-webkit-', '-moz-'];
        var transformStyle = vendors.map(s => s + 'transform: rotateY(180deg);').join('');
        this.debugCanvasA.setAttribute('style', transformStyle);

        this.debugCtxA = <CanvasRenderingContext2D> this.debugCanvasA.getContext('2d');

        document.body.appendChild(this.debugCanvasA);
    }

    private static createRoot() {
        var stage = document.createElement('div');
        stage.classList.add('webcam-game', 'webcam-selection-game');
        return stage;
    }
}

window.addEventListener('load', function () {
    var template = <HTMLTemplateElement> document.querySelector('#game-template');

    var webcam = new WebcamDisplay();
    webcam.start(document.body);

    webcam.onReady = () => {
        var adapter = new WebcamSelectionAdapter(webcam, true, true);
        adapter.loadTemplate(template);

        adapter.onSelected = (source) =>
        {
            source.click();
        };
    };
});
