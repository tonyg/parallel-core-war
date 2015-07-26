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
	var codeColor;
	var hue;
	var w = this.core.core[i];
	var sign = (w < 0) ? -1 : 1;
	w = (w < 0) ? -w : w;

	if (w != 0) {
	  w = Math.log(w) / Math.log(2);
	  w = w / 24;
	  hue = ((sign * w * 180) + 360) % 360;
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
