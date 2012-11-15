function RenderCore(canvasCodeId, canvasOwnerId, core) {
    this.scale = 4;
    this.core = core;
    this.canvasCode = document.getElementById(canvasCodeId);
    this.canvasOwner = document.getElementById(canvasOwnerId);
    this.codeContext = this.canvasCode.getContext("2d");
    this.ownerContext = this.canvasOwner.getContext("2d");

    var cellCount = this.core.core.length;
    this.width = Math.floor(Math.sqrt(cellCount));
    this.width = 5 * Math.floor(this.width / 5);
    this.height = Math.ceil(cellCount / this.width);

    this.canvasCode.width = this.width * this.scale;
    this.canvasCode.height = this.height * this.scale;
    this.canvasOwner.width = this.width * this.scale;
    this.canvasOwner.height = this.height * this.scale;
}

RenderCore.prototype.repaint = function () {
    var scale = this.scale;
    for (var y = 0; y < this.height; y++) {
	for (var x = 0; x < this.width; x++) {
	    var i = y * this.width + x;

	    if (i < this.core.core.length) {
		var hue = Math.log(this.core.makeSigned(this.core.core[i]));
		var codeColor;
		if (hue >= 0) {
		    hue = hue / Math.log(2);
		    hue = hue / this.core.wordsize;
		    hue = ((hue * 180) + 360) % 360;
		    codeColor = Color.fromTriple(Color.hsvToRgb(hue, 100, 100));
		} else {
		    codeColor = "black";
		}
		this.codeContext.fillStyle = codeColor;
		this.codeContext.fillRect(x * scale, y * scale, scale, scale);

		var o = this.core.ownership[i];
		this.ownerContext.fillStyle = o.color;
		this.ownerContext.fillRect(x * scale, y * scale, scale, scale);
	    } else {
		this.codeContext.clearRect(x * scale, y * scale, scale, scale);
		this.ownerContext.clearRect(x * scale, y * scale, scale, scale);
	    }
	}
    }
};