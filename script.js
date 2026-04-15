// --- DOM Elements ---
const canvas = document.getElementById('automataCanvas');
const ctx = canvas.getContext('2d');
const modeSwitch = document.getElementById('modeSwitch');
const addStateBtn = document.getElementById('addStateBtn');
const deleteStateBtn = document.getElementById('deleteStateBtn');
const markStartBtn = document.getElementById('markStartBtn');
const markAcceptBtn = document.getElementById('markAcceptBtn');

const sourceStateSelect = document.getElementById('sourceState');
const destStateSelect = document.getElementById('destState');
const transitionSymbolInput = document.getElementById('transitionSymbol');
const addTransitionBtn = document.getElementById('addTransitionBtn');
const transitionTableBody = document.querySelector('#transitionTable tbody');

const inputStringField = document.getElementById('inputString');
const stepBtn = document.getElementById('stepBtn');
const runBtn = document.getElementById('runBtn');
const resetSimulationBtn = document.getElementById('resetSimulationBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

const resultBanner = document.getElementById('resultBanner');
const resultText = document.getElementById('resultText');

const theoryBtn = document.getElementById('theoryBtn');
const theoryModal = document.getElementById('theoryModal');
const closeTheoryBtn = document.getElementById('closeTheoryBtn');

const authorBtn = document.getElementById('authorBtn');
const authorModal = document.getElementById('authorModal');
const closeAuthorBtn = document.getElementById('closeAuthorBtn');

const examplesBtn = document.getElementById('examplesBtn');
const examplesModal = document.getElementById('examplesModal');
const closeExamplesBtn = document.getElementById('closeExamplesBtn');

const loadDfaExampleBtn = document.getElementById('loadDfaExampleBtn');
const loadNfaExampleBtn = document.getElementById('loadNfaExampleBtn');

const darkModeToggle = document.getElementById('darkModeToggle');

// --- Global App State ---
let isDFA = true; // true = DFA, false = NFA
let isDarkMode = false;
let states = []; // { id: number, label: string, x: number, y: number, isStart: boolean, isAccept: boolean, radius: number }
let transitions = []; // { sourceId: number, destId: number, symbols: Set<string> }
let stateCounter = 0; // for q0, q1, etc.
const STATE_RADIUS = 25;

// Simulation State
let simulationMode = false;
let currentInputString = "";
let currentInputIndex = 0;
let activeStates = new Set(); // Stores IDs of currently active states
let autoRunInterval = null;

// Interaction State
let selectedStateId = null;
let draggingStateId = null;
let lastMousePos = { x: 0, y: 0 };


// --- Initialization ---
function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    setupEventListeners();
    requestAnimationFrame(renderLoop);
}

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

// --- Data Management ---

function addState() {
    // Determine position (center of canvas roughly, slightly staggered)
    const x = canvas.width / 2 + (Math.random() - 0.5) * 100;
    const y = canvas.height / 2 + (Math.random() - 0.5) * 100;

    // Auto-name
    const label = `q${stateCounter++}`;

    const newState = {
        id: Date.now() + Math.random(), // Unique ID
        label: label,
        x: x,
        y: y,
        isStart: states.length === 0, // First state is start by default
        isAccept: false,
        radius: STATE_RADIUS
    };

    states.push(newState);
    selectedStateId = newState.id; // Select newly created
    updateUI();
}

function deleteSelectedState() {
    if (selectedStateId === null) return;

    // Remove state
    states = states.filter(s => s.id !== selectedStateId);

    // Remove connected transitions
    transitions = transitions.filter(t => t.sourceId !== selectedStateId && t.destId !== selectedStateId);

    // Reset selection
    selectedStateId = null;

    // If we deleted start state and there are other states, make the first one start
    if (states.length > 0 && !states.some(s => s.isStart)) {
        states[0].isStart = true;
    }

    updateUI();
}

function toggleStartOnSelected() {
    if (selectedStateId === null) return;

    // Only one start state allowed
    states.forEach(s => s.isStart = false);
    const state = states.find(s => s.id === selectedStateId);
    if (state) state.isStart = true;

    updateUI();
}

function toggleAcceptOnSelected() {
    if (selectedStateId === null) return;
    const state = states.find(s => s.id === selectedStateId);
    if (state) state.isAccept = !state.isAccept;
    updateUI();
}


function addTransition() {
    const sourceId = parseFloat(sourceStateSelect.value);
    const destId = parseFloat(destStateSelect.value);
    const symbolStr = transitionSymbolInput.value.trim();

    if (isNaN(sourceId) || isNaN(destId)) return;

    // Parse symbols
    let symbolArr = symbolStr === "" ? ["ε"] : symbolStr.split(',').map(s => s.trim()).filter(s => s !== "");

    // If empty string or contains empty after trim/split, treat as epsilon
    if (symbolArr.length === 0) symbolArr = ["ε"];

    // Validation for DFA
    if (isDFA) {
        if (symbolArr.includes('ε')) {
            alert("Error: DFA cannot have epsilon (ε) transitions.");
            return;
        }

        // Check for non-determinism
        let hasConflict = false;
        symbolArr.forEach(sym => {
            const existingTrans = transitions.filter(t => t.sourceId === sourceId);
            existingTrans.forEach(t => {
                if (t.symbols.has(sym)) {
                    hasConflict = true;
                }
            });
        });

        if (hasConflict) {
            alert("Error: Non-deterministic transition. A DFA can only have one transition per symbol from each state.");
            return;
        }
    }

    // Find if a transition already exists between these two states
    let existingTrans = transitions.find(t => t.sourceId === sourceId && t.destId === destId);

    if (existingTrans) {
        // Add symbols to existing
        symbolArr.forEach(sym => existingTrans.symbols.add(sym));
    } else {
        // Create new
        transitions.push({
            sourceId: sourceId,
            destId: destId,
            symbols: new Set(symbolArr)
        });
    }

    transitionSymbolInput.value = "";
    updateUI();
}

function deleteTransition(sourceId, destId) {
    transitions = transitions.filter(t => !(t.sourceId === sourceId && t.destId === destId));
    updateUI();
}

function clearAll() {
    states = [];
    transitions = [];
    stateCounter = 0;
    selectedStateId = null;
    resetSimulation();
    updateUI();
}

// --- UI Updates ---

function updateUI() {
    // Update Select Dropdowns
    sourceStateSelect.innerHTML = '';
    destStateSelect.innerHTML = '';

    states.forEach(state => {
        const opt1 = document.createElement('option');
        opt1.value = state.id;
        opt1.textContent = state.label;
        if (state.id === selectedStateId) opt1.selected = true;
        sourceStateSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = state.id;
        opt2.textContent = state.label;
        destStateSelect.appendChild(opt2);
    });

    // Update Transition Table
    transitionTableBody.innerHTML = '';
    transitions.forEach(t => {
        const sourceState = states.find(s => s.id === t.sourceId);
        const destState = states.find(s => s.id === t.destId);
        if (!sourceState || !destState) return;

        const row = document.createElement('tr');

        // Source
        const tdSrc = document.createElement('td');
        tdSrc.textContent = sourceState.label;

        // Symbol
        const tdSym = document.createElement('td');
        tdSym.textContent = Array.from(t.symbols).join(', ');

        // Dest
        const tdDest = document.createElement('td');
        tdDest.textContent = destState.label;

        // Action
        const tdAction = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '×';
        delBtn.className = 'delete-row-btn';
        delBtn.onclick = () => deleteTransition(t.sourceId, t.destId);
        tdAction.appendChild(delBtn);

        row.appendChild(tdSrc);
        row.appendChild(tdSym);
        row.appendChild(tdDest);
        row.appendChild(tdAction);

        transitionTableBody.appendChild(row);
    });
}

// --- Interaction (Mouse Events) ---

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function getStateAtPos(x, y) {
    for (let i = states.length - 1; i >= 0; i--) { // Reverse order to get top item
        const state = states[i];
        const dx = x - state.x;
        const dy = y - state.y;
        if (dx * dx + dy * dy <= state.radius * state.radius) {
            return state;
        }
    }
    return null;
}

function setupEventListeners() {
    // Mode Toggle
    modeSwitch.addEventListener('change', (e) => {
        isDFA = !e.target.checked;
        document.getElementById('dfa-label').classList.toggle('active', isDFA);
        document.getElementById('nfa-label').classList.toggle('active', !isDFA);

        // Simple warning when switching to DFA if potentially invalid
        if (isDFA && transitions.some(t => t.symbols.has('ε'))) {
            alert("Warning: You are switching to DFA mode, but there are ε-transitions present. Please fix them.");
        }
    });

    // Buttons
    addStateBtn.addEventListener('click', addState);
    deleteStateBtn.addEventListener('click', deleteSelectedState);
    markStartBtn.addEventListener('click', toggleStartOnSelected);
    markAcceptBtn.addEventListener('click', toggleAcceptOnSelected);
    addTransitionBtn.addEventListener('click', addTransition);
    clearAllBtn.addEventListener('click', clearAll);

    // Canvas Mouse Events
    canvas.addEventListener('mousedown', (e) => {
        const pos = getMousePos(e);
        const clickedState = getStateAtPos(pos.x, pos.y);

        if (clickedState) {
            selectedStateId = clickedState.id;
            draggingStateId = clickedState.id;
            lastMousePos = pos;

            // Sync dropdown
            sourceStateSelect.value = clickedState.id;
        } else {
            selectedStateId = null; // Unselect
        }
        updateUI();
    });

    canvas.addEventListener('mousemove', (e) => {
        if (draggingStateId !== null) {
            const pos = getMousePos(e);
            const state = states.find(s => s.id === draggingStateId);
            if (state) {
                state.x += (pos.x - lastMousePos.x);
                state.y += (pos.y - lastMousePos.y);
                lastMousePos = pos;
            }
        }
    });

    canvas.addEventListener('mouseup', () => {
        draggingStateId = null;
    });

    canvas.addEventListener('mouseleave', () => {
        draggingStateId = null;
    });

    // Simulation Buttons
    stepBtn.addEventListener('click', stepSimulation);
    runBtn.addEventListener('click', toggleAutoRun);
    resetSimulationBtn.addEventListener('click', resetSimulation);

    // Theme Toggle
    darkModeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode', isDarkMode);
        darkModeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    });

    // Modals
    theoryBtn.addEventListener('click', () => theoryModal.classList.remove('hidden'));
    closeTheoryBtn.addEventListener('click', () => theoryModal.classList.add('hidden'));
    theoryModal.addEventListener('click', (e) => {
        if (e.target === theoryModal) theoryModal.classList.add('hidden');
    });

    authorBtn.addEventListener('click', () => authorModal.classList.remove('hidden'));
    closeAuthorBtn.addEventListener('click', () => authorModal.classList.add('hidden'));
    authorModal.addEventListener('click', (e) => {
        if (e.target === authorModal) authorModal.classList.add('hidden');
    });

    examplesBtn.addEventListener('click', () => examplesModal.classList.remove('hidden'));
    closeExamplesBtn.addEventListener('click', () => examplesModal.classList.add('hidden'));
    examplesModal.addEventListener('click', (e) => {
        if (e.target === examplesModal) examplesModal.classList.add('hidden');
    });

    // Examples Loader
    loadDfaExampleBtn.addEventListener('click', loadDfaExample);
    loadNfaExampleBtn.addEventListener('click', loadNfaExample);
}

// --- Example Loaders ---
function loadDfaExample() {
    clearAll();
    isDFA = true;
    modeSwitch.checked = false; // DFA Mode
    document.getElementById('dfa-label').classList.add('active');
    document.getElementById('nfa-label').classList.remove('active');

    const cy = canvas.height / 2;
    const cx = canvas.width / 2;

    const s0 = { id: 1, label: 'q0', x: cx - 150, y: cy, isStart: true, isAccept: false, radius: STATE_RADIUS };
    const s1 = { id: 2, label: 'q1', x: cx, y: cy, isStart: false, isAccept: false, radius: STATE_RADIUS };
    const s2 = { id: 3, label: 'q2', x: cx + 150, y: cy, isStart: false, isAccept: true, radius: STATE_RADIUS };

    states.push(s0, s1, s2);
    stateCounter = 3;

    transitions.push({ sourceId: 1, destId: 1, symbols: new Set(['0']) });
    transitions.push({ sourceId: 1, destId: 2, symbols: new Set(['1']) });
    transitions.push({ sourceId: 2, destId: 1, symbols: new Set(['0']) });
    transitions.push({ sourceId: 2, destId: 3, symbols: new Set(['1']) });
    transitions.push({ sourceId: 3, destId: 1, symbols: new Set(['0']) });
    transitions.push({ sourceId: 3, destId: 3, symbols: new Set(['1']) }); // wait, binary ending in '11' would be this. Wait... my DFA says 'ends in 01'.. oops let me fix logic. Let's make it ends in '01'.

    transitions = []; // Reset transitions
    transitions.push({ sourceId: 1, destId: 1, symbols: new Set(['1']) });
    transitions.push({ sourceId: 1, destId: 2, symbols: new Set(['0']) });

    transitions.push({ sourceId: 2, destId: 2, symbols: new Set(['0']) });
    transitions.push({ sourceId: 2, destId: 3, symbols: new Set(['1']) });

    transitions.push({ sourceId: 3, destId: 2, symbols: new Set(['0']) });
    transitions.push({ sourceId: 3, destId: 1, symbols: new Set(['1']) });

    examplesModal.classList.add('hidden');
    inputStringField.value = "101101";
    updateUI();
}

function loadNfaExample() {
    clearAll();
    isDFA = false;
    modeSwitch.checked = true; // NFA Mode
    document.getElementById('dfa-label').classList.remove('active');
    document.getElementById('nfa-label').classList.add('active');

    const cy = canvas.height / 2;
    const cx = canvas.width / 2;

    const s0 = { id: 1, label: 'q0', x: cx - 150, y: cy, isStart: true, isAccept: false, radius: STATE_RADIUS };
    const s1 = { id: 2, label: 'q1', x: cx, y: cy, isStart: false, isAccept: false, radius: STATE_RADIUS };
    const s2 = { id: 3, label: 'q2', x: cx + 150, y: cy, isStart: false, isAccept: true, radius: STATE_RADIUS };

    states.push(s0, s1, s2);
    stateCounter = 3;

    // Contains '11'
    transitions.push({ sourceId: 1, destId: 1, symbols: new Set(['0', '1']) });
    transitions.push({ sourceId: 1, destId: 2, symbols: new Set(['1']) });
    transitions.push({ sourceId: 2, destId: 3, symbols: new Set(['1']) });
    transitions.push({ sourceId: 3, destId: 3, symbols: new Set(['0', '1']) });

    examplesModal.classList.add('hidden');
    inputStringField.value = "001100";
    updateUI();
}

// --- Simulation Logic ---

// Computes the epsilon-closure of a set of state IDs
function getEpsilonClosure(stateIds) {
    let closure = new Set(stateIds);
    let stack = Array.from(stateIds);

    while (stack.length > 0) {
        let currentId = stack.pop();
        // Find all transitions from currentId with symbol ε
        const epsTransitions = transitions.filter(t => t.sourceId === currentId && t.symbols.has('ε'));

        epsTransitions.forEach(t => {
            if (!closure.has(t.destId)) {
                closure.add(t.destId);
                stack.push(t.destId);
            }
        });
    }
    return closure;
}

function validateAutomaton() {
    if (states.length === 0) {
        return "Error: Automaton has no states.";
    }

    let alphabet = new Set();
    transitions.forEach(t => {
        t.symbols.forEach(sym => {
            if (sym !== 'ε') alphabet.add(sym);
        });
    });

    if (isDFA) {
        const hasEpsilon = transitions.some(t => t.symbols.has('ε'));
        if (hasEpsilon) {
            return "Error: Invalid DFA. Contains ε-transitions.";
        }

        for (const state of states) {
            const stateTransitions = transitions.filter(t => t.sourceId === state.id);
            let stateSymbols = new Map();
            for (const t of stateTransitions) {
                for (const sym of t.symbols) {
                    if (stateSymbols.has(sym)) {
                        return `Error: Invalid DFA. Non-deterministic transition from ${state.label} on '${sym}'.`;
                    }
                    stateSymbols.set(sym, true);
                }
            }

            for (const sym of alphabet) {
                if (!stateSymbols.has(sym)) {
                    return `Error: Invalid DFA. Missing transition from ${state.label} on '${sym}'.`;
                }
            }
        }

        for (let i = 0; i < currentInputString.length; i++) {
            const char = currentInputString[i];
            if (!alphabet.has(char)) {
                return `Error: Invalid DFA. Missing transition for input symbol '${char}'.`;
            }
        }
    }

    return null;
}

function startSimulation() {
    simulationMode = true;
    currentInputString = inputStringField.value;
    currentInputIndex = 0;
    hideResult();

    const validationError = validateAutomaton();
    if (validationError) {
        showResult(validationError, false);
        simulationMode = false;
        return false;
    }

    // Find start state
    const startState = states.find(s => s.isStart);
    if (!startState) {
        showResult("Error: No start state defined.", false);
        simulationMode = false;
        return false;
    }

    activeStates = new Set();
    activeStates.add(startState.id);

    if (!isDFA) {
        activeStates = getEpsilonClosure(activeStates);
    }

    if (currentInputString.length === 0) {
        checkAcceptance(); // Empty string case
    }

    return true;
}

function stepSimulation() {
    if (!simulationMode || currentInputIndex >= currentInputString.length) {
        if (currentInputIndex >= currentInputString.length && currentInputString.length > 0 && simulationMode) {
            checkAcceptance(); // already finished
        } else {
            const started = startSimulation(); // auto-start if clicking step without running
            if (started && currentInputString.length > 0) processSymbol();
        }
        return;
    }

    processSymbol();
}

function processSymbol() {
    const symbol = currentInputString[currentInputIndex];
    let nextActiveStates = new Set();

    activeStates.forEach(currentStateId => {
        // Find transitions matching the symbol from this state
        const validTransitions = transitions.filter(t => t.sourceId === currentStateId && t.symbols.has(symbol));
        validTransitions.forEach(t => {
            nextActiveStates.add(t.destId);
        });
    });

    if (!isDFA) {
        nextActiveStates = getEpsilonClosure(nextActiveStates);
    }

    activeStates = nextActiveStates;
    currentInputIndex++;

    if (currentInputIndex >= currentInputString.length) {
        checkAcceptance();
    }
}

function toggleAutoRun() {
    // If not started or already finished, restart
    if (!simulationMode || currentInputIndex >= currentInputString.length) {
        const started = startSimulation();
        if (!started) return;
    }

    if (autoRunInterval !== null) {
        // Stop
        clearInterval(autoRunInterval);
        autoRunInterval = null;
        runBtn.textContent = 'Run';
        runBtn.classList.remove('danger');
        runBtn.classList.add('success');
    } else {
        // Start
        runBtn.textContent = 'Stop';
        runBtn.classList.remove('success');
        runBtn.classList.add('danger');

        autoRunInterval = setInterval(() => {
            if (currentInputIndex < currentInputString.length) {
                stepSimulation();
            } else {
                clearInterval(autoRunInterval);
                autoRunInterval = null;
                runBtn.textContent = 'Run';
                runBtn.classList.remove('danger');
                runBtn.classList.add('success');
            }
        }, 700); // 700ms delay per step
    }
}

function checkAcceptance() {
    // See if any of the active states are accepting
    let accepted = false;
    activeStates.forEach(id => {
        const s = states.find(state => state.id === id);
        if (s && s.isAccept) accepted = true;
    });

    if (activeStates.size === 0) {
        showResult("REJECTED (No valid paths)", false);
    } else if (accepted) {
        showResult("ACCEPTED", true);
    } else {
        showResult("REJECTED", false);
    }
}

function resetSimulation() {
    simulationMode = false;
    activeStates.clear();
    currentInputIndex = 0;
    hideResult();
    if (autoRunInterval !== null) {
        clearInterval(autoRunInterval);
        autoRunInterval = null;
        runBtn.textContent = 'Run';
        runBtn.classList.remove('danger');
        runBtn.classList.add('success');
    }
}

function showResult(text, isAccept) {
    resultText.textContent = text;
    resultBanner.className = 'result-banner'; // reset
    if (isAccept) {
        resultBanner.classList.add('accepted');
    } else {
        resultBanner.classList.add('rejected');
    }
}

function hideResult() {
    resultBanner.className = 'result-banner hidden';
}


// --- Canvas Rendering logic ---

function drawArrowhead(ctx, x, y, angle) {
    const headLength = 12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-headLength, -headLength / 2);
    ctx.lineTo(-headLength, headLength / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function renderLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges underneath nodes
    drawTransitions();

    // Draw nodes on top
    drawStates();

    requestAnimationFrame(renderLoop);
}

function drawTransitions() {
    ctx.font = '14px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const selfLoopRadius = 25;
    const strokeColor = isDarkMode ? '#ffffff' : '#000000';

    transitions.forEach(t => {
        const sourceState = states.find(s => s.id === t.sourceId);
        const destState = states.find(s => s.id === t.destId);
        if (!sourceState || !destState) return;

        ctx.beginPath();
        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = strokeColor;
        ctx.lineWidth = 3;

        const label = Array.from(t.symbols).join(', ');

        if (t.sourceId === t.destId) {
            // Self Loop (draw above the node)
            const cx = sourceState.x;
            const cy = sourceState.y - sourceState.radius - selfLoopRadius;

            ctx.arc(cx, cy + 10, selfLoopRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Draw arrowhead
            drawArrowhead(ctx, sourceState.x + 5, sourceState.y - sourceState.radius, Math.PI / 4);

            // Label
            ctx.fillText(label, cx, cy - selfLoopRadius + 5);

        } else {
            // Check if there's a bidirectional edge to curve them
            const hasReverse = transitions.some(revT => revT.sourceId === t.destId && revT.destId === t.sourceId);

            const dx = destState.x - sourceState.x;
            const dy = destState.y - sourceState.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Avoid drawing if overlap entirely
            if (dist === 0) return;

            const unitX = dx / dist;
            const unitY = dy / dist;

            // Start/End points at edge of radius
            const startX = sourceState.x + unitX * sourceState.radius;
            const startY = sourceState.y + unitY * sourceState.radius;
            const endX = destState.x - unitX * destState.radius;
            const endY = destState.y - unitY * destState.radius;

            if (hasReverse) {
                // Curved Line
                const curveHeight = 40;
                // Normal vector
                const nx = -unitY;
                const ny = unitX;

                const midX = (startX + endX) / 2 + nx * curveHeight;
                const midY = (startY + endY) / 2 + ny * curveHeight;

                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(midX, midY, endX, endY);
                ctx.stroke();

                // Determine tangent for arrowhead
                const tgtX = endX - midX;
                const tgtY = endY - midY;
                const angle = Math.atan2(tgtY, tgtX);
                drawArrowhead(ctx, endX, endY, angle);

                // Label
                ctx.fillText(label, midX, midY - 5);
            } else {
                // Straight Line
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                const angle = Math.atan2(dy, dx);
                drawArrowhead(ctx, endX, endY, angle);

                // Label at midpoint
                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;
                // Push label slightly "up"
                const nx = -unitY;
                const ny = unitX;
                ctx.fillText(label, midX + nx * 15, midY + ny * 15);
            }
        }
    });
}

function drawStates() {
    const defaultColor = isDarkMode ? '#ffffff' : '#000000';
    const bgFill = isDarkMode ? '#2c2c2c' : '#ffffff';

    states.forEach(state => {

        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = state.id === selectedStateId ? 5 : 3;
        ctx.strokeStyle = state.id === selectedStateId ? '#ff00ff' : defaultColor;
        ctx.fillStyle = bgFill;

        // Highlight active states during simulation
        if (simulationMode && activeStates.has(state.id)) {
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 6;
            ctx.shadowOffsetY = 6;
            ctx.shadowColor = defaultColor;
            ctx.fillStyle = '#00ffc4'; // Bright cyan indicating active
        } else {
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;
            ctx.shadowColor = defaultColor;
        }

        ctx.arc(state.x, state.y, state.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Reset shadow
        ctx.restore();

        // Double circle for accepting state
        if (state.isAccept) {
            ctx.beginPath();
            ctx.lineWidth = 3;
            ctx.strokeStyle = state.id === selectedStateId ? '#ff00ff' : defaultColor;
            ctx.arc(state.x, state.y, state.radius - 6, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Start arrow
        if (state.isStart) {
            ctx.beginPath();
            ctx.lineWidth = 3;
            ctx.strokeStyle = defaultColor;
            ctx.fillStyle = defaultColor;
            const arrowStartX = state.x - state.radius - 40;
            const arrowEndX = state.x - state.radius - 5;
            ctx.moveTo(arrowStartX, state.y);
            ctx.lineTo(arrowEndX, state.y);
            ctx.stroke();
            drawArrowhead(ctx, arrowEndX, state.y, 0); // pointing right
        }

        // Label text

        ctx.fillStyle = (simulationMode && activeStates.has(state.id)) ? '#000000' : defaultColor;
        ctx.font = '800 16px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(state.label, state.x, state.y);
    });
}


// Start App
init();
