var core;
var renderer;
var owner = new Owner("rgb(0,255,0)");
var continuous = false;
var fuel = 0;
var dumpRangeChanged = false;

function single_iteration() {
    if (continuous || fuel > 0) {
	if (!continuous) fuel--;

	core.step();
	refresh_display();
    }
    setTimeout(single_iteration, 10);
}

function refresh_display() {
    renderer.repaint();
    document.getElementById("instructionCounter").innerHTML = core.instructionCounter;

    var lo = Number(document.getElementById("dumpLo").value);
    var hi = Number(document.getElementById("dumpHi").value);
    document.getElementById("dumpArea").value = document.getElementById("dumpAreaPost").value;
    document.getElementById("dumpAreaPost").value = (lo == hi) ? "" : core.dump(lo, hi);
}

function dump_range_change() {
    dumpRangeChanged = true;
    refresh_display();
}

function reset_core() {
    Math.seedrandom("parallelcore");
    core = new Core(4096, false);
    renderer = new RenderCore("canvasCode", "canvasOwner", core);

    var source = document.getElementById("sourceCode").value;
    var targetAddr = core.clamp(core.randomWord());
    var assemblyLength = core.assemble(source, targetAddr, owner);
    if (!dumpRangeChanged) {
	document.getElementById("dumpLo").value = String(targetAddr);
	document.getElementById("dumpHi").value = String(targetAddr + assemblyLength
							 + 25 /* TODO remove the 25 */ );
    }
    document.getElementById("dumpAreaPost").value = "";

    stop_core();
    refresh_display();
}

function run_core() {
    continuous = true;
    fuel = 0;
}

function stop_core() {
    continuous = false;
    fuel = 0;
}

function step_core() {
    continuous = false;
    fuel = 1;
}

function index_main() {
    reset_core();
    single_iteration();
}
