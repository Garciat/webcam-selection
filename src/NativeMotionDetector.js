class NativeMotionDetector {
    private canvasA: HTMLCanvasElement;
    private ctxA: CanvasRenderingContext2D;
    
    private canvasB: HTMLCanvasElement;
    private ctxB: CanvasRenderingContext2D;
    
    private canvasC: HTMLCanvasElement;
    private ctxC: CanvasRenderingContext2D;
    
    private lastData: Uint8ClampedArray = null;
    private processed: Uint8ClampedArray;
    
    constructor(private video: HTMLVideoElement) {
        this.canvasA = document.createElement('canvas');
        this.canvasA.width = video.clientWidth;
        this.canvasA.height = video.clientHeight;
        
        this.canvasB = document.createElement('canvas');
        this.canvasB.width = video.clientWidth;
        this.canvasB.height = video.clientHeight;
        
        this.canvasC = document.createElement('canvas');
        this.canvasC.width = video.clientWidth;
        this.canvasC.height = video.clientHeight;
        
        this.ctxA = <CanvasRenderingContext2D> this.canvasA.getContext('2d');
        this.ctxB = <CanvasRenderingContext2D> this.canvasB.getContext('2d');
        this.ctxC = <CanvasRenderingContext2D> this.canvasC.getContext('2d');
    }
    
    process() {
        var w = this.canvasA.width;
        var h = this.canvasA.height;
        
        this.ctxA.globalCompositeOperation = 'source-over';
        this.ctxA.drawImage(this.canvasB, 0, 0);
        this.ctxB.drawImage(this.video, 0, 0);
        
        this.ctxA.globalCompositeOperation = 'difference';
        this.ctxA.drawImage(this.video, 0, 0);
        
        this.ctxC.globalCompositeOperation = 'source-over';
        this.ctxC.fillStyle = 'black';
        this.ctxC.fillRect(0, 0, w, h);
        this.ctxC.globalCompositeOperation = 'luminosity';
        this.ctxC.drawImage(this.canvasA, 0, 0);
        
        this.ctxA.globalCompositeOperation = 'source-over';
        this.ctxA.fillStyle = 'white';
        this.ctxA.fillRect(0, 0, w, h);
        this.ctxA.globalCompositeOperation = 'difference';
        this.ctxA.drawImage(this.canvasC, 0, 0);
    }
    
    query(x1: number, y1: number, x2: number, y2: number): number {
        return null;
    }
    
    putDebugData(ctx: CanvasRenderingContext2D) {
        ctx.drawImage(this.canvasA, 0, 0);
    }
}