// Parallel Core War
// Copyright 2012 Tony Garnock-Jones <tonygarnockjones@gmail.com>

// Addressing modes:
//  - immediate ("$123"), encoded as 00
//  - direct ("123"), encoded as 01
//  - indirect ("@123"), encoded as 11
//
// All addressing is relative, initially to the executing
// instruction's address.
//
// The distinct false value is 0. All other values are considered
// true. All arithmetic is unsigned, and is modulo the core size.
//
// Instructions are of the form
//
// [IF <condaddr>] <op> <target> <source1> <source2>
//
// and conditionally execute only when <condaddr> is non-false. When
// "IF <condaddr>" is omitted from the text representation of an
// instruction, $-1 is used as the condaddr, meaning "always execute".
//
// Operators are ADD, SUB, MUL, DIV, MOD for arithmetic, and EQ, NE,
// LT, GE for comparison. They are numbered in order starting from
// zero.
//
// A MOV can be accomplished by ADDing $0 to some other source.
//
// The quasiinstruction DAT places five literal words into the machine
// code.
//
// Instructions are encoded in five adjacent words, aligned on a
// five-word boundary. Since there are three addressing modes, we need
// two bits for each addressing mode. Nine operators fit in four bits.
// Since each instruction needs four addressing mode fields and one
// operator field, that makes our minimum word size twelve bits.
//
// With a 16-bit word size, then, instructions are 5*16 = 80 bits
// wide, and look like this:
//
// ZZZZMMMMMMMMOOOO CCCCCCCCCCCCCCCC TTTTTTTTTTTTTTTT 1111111111111111 2222222222222222
//
// For example, ADD -1, -1, $1 would be encoded (remembering the
// implicit $-1 condaddr)
//
// 0000000101000000 1111111111111111 1111111111111111 1111111111111111 0000000000000001
// .... - unused, must be zero
//     .. - immediate condaddr
//       .. - direct target
//         .. - direct source1
//           .. - immediate source2
//             .... - op = ADD
//                  ................ - condaddr = -1
//                                   ................ - target = -1
//                                                    ................ - source1 = -1
//                                                                     ................ - source2=1
//
// Invalid instructions:
//  - non-zero high operator bits
//  - immediate target
//  - any use of addressing mode 10
//  - undefined operator
//  - division/modulus by zero

function Core(wordsize) {
    if (wordsize < 12) {
	throw new Error("Core's wordsize must not be less than 12");
    }
    this.wordsize = wordsize;
    this.maxint = (1 << wordsize) - 1;
    this.core = new Array(this.maxint + 1);

    for (var i = 0; i < this.core.length; i++) {
	this.core[i] = Math.floor(Math.random() * (this.maxint + 1));
    }
}

Core.Modes = {
    IMMEDIATE: 0,
    DIRECT: 1,
    INVALID_MODE: 2,
    INDIRECT: 3
};

Core.ModeSigils = [ '$', '', '??', '@' ];

Core.OpNames = [ 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'EQ', 'NE', 'LT',
		 'GE', '??', '??', '??', '??', '??', '??', '??' ];

Core.prototype.assemble = function (source, targetaddr) {
    function emitword(w) {
	this.core[targetaddr] = w;
	targetaddr++;
    }

    var lines = source.split(/\n/);
    for (var linenum = 0; linenum < lines.length; linenum++) {
	var line = lines[linenum].trim();
	var m;

	if (!line) continue;

	if ((m = line.match(/DAT\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/i))) {
	    for (var i = 0; i < 5; i++) {
		emitword(parseaddr(m[i + 1]).value);
	    }
	} else {
	    var condaddr = {mode: Core.Modes.IMMEDIATE, value: this.maxint};
	    if ((m = line.match(/IF\s+(\S+)\s+(.*)/i))) {
		var condaddr = parseaddr(m[1]);
		line = m[2];
	    }
	    if ((m = line.match(/(\S)+\s+(\S)+\s+(\S)+\s+(\S)+/i))) {
		var op = parseop(m[1]);
		function parseop(op) {
		    if (op.match(/add/i)) return 0;
		    if (op.match(/sub/i)) return 1;
		    if (op.match(/mul/i)) return 2;
		    if (op.match(/div/i)) return 3;
		    if (op.match(/mod/i)) return 4;
		    if (op.match(/eq/i)) return 5;
		    if (op.match(/ne/i)) return 6;
		    if (op.match(/lt/i)) return 7;
		    if (op.match(/ge/i)) return 8;
		    throw new Error("Invalid core operator " + op + " on line " + (linenum + 1));
		}
		var t = parseaddr(m[2]);
		var s1 = parseaddr(m[3]);
		var s2 = parseaddr(m[4]);
		emitword((condaddr.mode << 10) |
			 (t.mode << 8) |
			 (s1.mode << 6) |
			 (s2.mode << 4) |
			 op);
		emitword(condaddr.value);
		emitword(t.value);
		emitword(s1.value);
		emitword(s2.value);
	    } else {
		throw new Error("Core syntax error on line " + (linenum + 1));
	    }
	}
    }
};

Core.prototype.dump = function (lo, hi) {
    if (hi === 0) hi = this.core.length;

    function encodeaddr(a) {
	return Core.ModeSigils[a.mode] + a.value;
    }

    for (var i = lo; i + 5 <= hi; i += 5) {
	var opword = this.core[i];
	var condaddr = {mode: (opword >> 10) & 3, value: this.core[i+1]};
	var t = {mode: (opword >> 8) & 3, value: this.core[i+2]};
	var s1 = {mode: (opword >> 6) & 3, value: this.core[i+3]};
	var s2 = {mode: (opword >> 4) & 3, value: this.core[i+4]};
	var op = opword & 15;
	var line = "";
	if (condaddr.mode != Core.Modes.IMMEDIATE || condaddr.value != this.maxint) {
	    line = line + "IF " + encodeaddr(condaddr) + " ";
	}
	line = line + Core.OpNames[op] +
	    " " + encodeaddr(t) +
	    " " + encodeaddr(s1) +
	    " " + encodeaddr(s2);
	console.log(line);
    }
}

Core.prototype.step = function () {
    var $elf = this;
    var newcore = this.core.slice(0);
    for (var i = 0; i + 5 <= this.core.length; i += 5) {
	var opword = this.core[i];
	var condaddr = {mode: (opword >> 10) & 3, value: this.core[i+1]};
	var t = {mode: (opword >> 8) & 3, value: this.core[i+2]};
	var s1 = {mode: (opword >> 6) & 3, value: this.core[i+3]};
	var s2 = {mode: (opword >> 4) & 3, value: this.core[i+4]};

	function validR(a) {
	    return a.mode != Core.Modes.INVALID_MODE;
	}

	function validW(a) {
	    return validR(a) && a.mode != Core.Modes.IMMEDIATE;
	}

	function lea(a) {
	    switch (a.mode) {
	    case Core.Modes.DIRECT:
		return i + a.value;
	    case Core.Modes.INDIRECT:
		return i + a.value + $elf.core[i + a.value];
	    default:
		"invalid";
	    }
	}

	function deref(a) {
	    if (a.mode === Core.Modes.IMMEDIATE) return a.value;
	    return $elf.core[lea(a)];
	}

	if (!validR(condaddr)) continue;
	if (!validR(s1)) continue;
	if (!validR(s2)) continue;
	if (!validW(t)) continue;

	if (!deref(condaddr)) continue;

	switch (opword & 15) {
	case 0: /* add */ newcore[lea(t)] = (deref(s1) + deref(s2)) & this.maxint; break;
	case 1: /* sub */ newcore[lea(t)] = (deref(s1) - deref(s2)) & this.maxint; break;
	case 2: /* mul */ newcore[lea(t)] = (deref(s1) * deref(s2)) & this.maxint; break;
	case 3: /* div */ newcore[lea(t)] = Math.floor(deref(s1) / deref(s2)) & this.maxint; break;
	case 4: /* mod */ newcore[lea(t)] = (deref(s1) % deref(s2)) & this.maxint; break;
	case 5: /* eq */ newcore[lea(t)] = 0 + (deref(s1) == deref(s2)); break;
	case 6: /* ne */ newcore[lea(t)] = 0 + (deref(s1) != deref(s2)); break;
	case 7: /* lt */ newcore[lea(t)] = 0 + (deref(s1) < deref(s2)); break;
	case 8: /* ge */ newcore[lea(t)] = 0 + (deref(s1) >= deref(s2)); break;
	default: continue;
	}
    }
    this.core = newcore;
}

///////////////////////////////////////////////////////////////////////////

require("./seedrandom.js");
Math.seedrandom("core");
var core = new Core(12);
var counter = 0;
while (true) {
    console.log(counter + " ----------------------------------------");
    counter++;
    //core.dump(0, 50);
    core.step();
}
