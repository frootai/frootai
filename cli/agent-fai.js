#!/usr/bin/env node
"use strict";

process.argv.splice(2, 0, "agent");
require("./bin.js");