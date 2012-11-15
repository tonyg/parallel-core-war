function RenderCore(canvasId, core) {
    this.scale = 4;
    this.core = core;
    this.canvas = document.getElementById(canvasId);
    this.context = this.canvas.getContext("2d");

    var cellCount = this.core.core.length;
    this.width = Math.floor(Math.sqrt(cellCount));
    this.height = 1;
    while (this.width > 1) {
	this.height = Math.floor(cellCount / this.width);
	if (this.width * this.height === cellCount) break;
	this.width--;
    }
    this.canvas.width = this.width * this.scale;
    this.canvas.height = this.height * this.scale;
}

RenderCore.prototype.repaint = function () {
    for (var y = 0; y < this.height; y++) {
	for (var x = 0; x < this.width; x++) {
	    var i = y * this.width + x;
	    var o = this.core.ownership[i];
	    this.context.fillStyle = o.color;
	    this.context.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
	}
    }
};