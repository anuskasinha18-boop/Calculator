/* -------------------------------------------------------------
 * PREMIUM NEUMORPHIC CALCULATOR - INTERACTIVITY & LOGIC
 * Features: Mathematical core, Web Audio click synthesis,
 * history drawer management, keyboard mapping, and themes.
 * ------------------------------------------------------------- */

// State variables
let formulaBuffer = '';
let currentInput = '0';
let lastResult = null;
let shouldResetDisplay = false;
let isSoundEnabled = true;
let isScientificActive = false;
let calculationHistory = [];

// Audio Context for sound synthesis (initialized lazily)
let audioCtx = null;

// DOM Elements
const formulaDisplay = document.getElementById('formula-display');
const resultDisplay = document.getElementById('result-display');
const keypad = document.getElementById('keypad');
const soundToggle = document.getElementById('sound-toggle');
const soundOnIcon = soundToggle.querySelector('.sound-on-icon');
const soundOffIcon = soundToggle.querySelector('.sound-off-icon');
const expandToggle = document.getElementById('expand-toggle');
const themeToggle = document.getElementById('theme-toggle');
const scientificPanel = document.getElementById('scientific-panel');
const historyToggle = document.getElementById('history-toggle');
const historyClose = document.getElementById('history-close');
const historyDrawer = document.getElementById('history-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');

// Load configurations from localStorage
function initConfig() {
  // Theme configuration
  const savedTheme = localStorage.getItem('calc-theme') || 'light-theme';
  document.body.className = savedTheme;
  
  // Sound configuration
  const savedSound = localStorage.getItem('calc-sound');
  if (savedSound !== null) {
    isSoundEnabled = savedSound === 'true';
    updateSoundIcons();
  }

  // History configuration
  const savedHistory = localStorage.getItem('calc-history');
  if (savedHistory) {
    calculationHistory = JSON.parse(savedHistory);
    renderHistory();
  }
}

// -------------------------------------------------------------
// WEB AUDIO SYNTHESIS FOR SATISFYING BUTTON CLICK
// -------------------------------------------------------------
function playClickSound() {
  if (!isSoundEnabled) return;

  try {
    // Lazily initialize Web Audio API
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume context if suspended (browser security autoplay policy)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Create a snappy mechanical bubble-click sound
    // 1. Oscillator for the tone
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    
    // Snappy pitch slide down
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);

    // Fast volume envelope
    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.06);

    // 2. High-frequency click tick using short noise burst
    const bufferSize = audioCtx.sampleRate * 0.005; // 5ms burst
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(5000, now);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.02, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.005);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    noise.start(now);
    noise.stop(now + 0.006);

  } catch (error) {
    console.warn('Audio synthesis failed:', error);
  }
}

// Update sound toggle button SVG UI
function updateSoundIcons() {
  if (isSoundEnabled) {
    soundOnIcon.classList.remove('hidden');
    soundOffIcon.classList.add('hidden');
  } else {
    soundOnIcon.classList.add('hidden');
    soundOffIcon.classList.remove('hidden');
  }
}

// Toggle Sound setting
soundToggle.addEventListener('click', () => {
  isSoundEnabled = !isSoundEnabled;
  localStorage.setItem('calc-sound', isSoundEnabled);
  updateSoundIcons();
  if (isSoundEnabled) playClickSound();
});

// -------------------------------------------------------------
// DISPLAY CONTROLLER & UI SCALING
// -------------------------------------------------------------
function updateDisplay() {
  // Update formula view
  // Format operator characters visually (* to ×, / to ÷)
  let formattedFormula = formulaBuffer
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/\+/g, ' + ')
    .replace(/\-/g, ' − ');
  formulaDisplay.textContent = formattedFormula;

  // Format current input (add thousand separators if applicable)
  let displayVal = currentInput;
  
  // Format NaN or Infinity nicely
  if (displayVal === 'NaN') displayVal = 'Error';
  if (displayVal === 'Infinity' || displayVal === '-Infinity') displayVal = 'Limit exceeded';

  resultDisplay.textContent = displayVal;

  // Adjust font size dynamically to prevent overflow
  const length = displayVal.length;
  resultDisplay.classList.remove('medium-text', 'small-text');
  if (length > 15) {
    resultDisplay.classList.add('small-text');
  } else if (length > 10) {
    resultDisplay.classList.add('medium-text');
  }
}

// -------------------------------------------------------------
// SCIENTIFIC VIEW TOGGLE
// -------------------------------------------------------------
expandToggle.addEventListener('click', () => {
  playClickSound();
  isScientificActive = !isScientificActive;
  if (isScientificActive) {
    scientificPanel.classList.add('active');
    expandToggle.classList.add('active');
    expandToggle.style.transform = 'scale(1.1) rotate(180deg)';
  } else {
    scientificPanel.classList.remove('active');
    expandToggle.classList.remove('active');
    expandToggle.style.transform = 'scale(1.0) rotate(0deg)';
  }
});

// -------------------------------------------------------------
// THEME SWITCHER
// -------------------------------------------------------------
themeToggle.addEventListener('click', () => {
  playClickSound();
  const currentTheme = document.body.className;
  let newTheme = 'light-theme';
  
  if (currentTheme === 'light-theme') {
    newTheme = 'dark-theme';
  }
  
  document.body.className = newTheme;
  localStorage.setItem('calc-theme', newTheme);
});

// -------------------------------------------------------------
// HISTORY DRAWER CONTROLS
// -------------------------------------------------------------
function toggleHistoryDrawer(open) {
  if (open) {
    historyDrawer.classList.add('active');
    drawerOverlay.classList.add('active');
  } else {
    historyDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
  }
}

historyToggle.addEventListener('click', () => {
  playClickSound();
  toggleHistoryDrawer(true);
});

historyClose.addEventListener('click', () => {
  playClickSound();
  toggleHistoryDrawer(false);
});

drawerOverlay.addEventListener('click', () => {
  toggleHistoryDrawer(false);
});

// Save calculation to history
function saveToHistory(formula, result) {
  // Format operator characters visually for storage
  const formattedFormula = formula
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ');
    
  calculationHistory.unshift({ formula: formattedFormula, result });
  
  // Cap history at 30 items
  if (calculationHistory.length > 30) {
    calculationHistory.pop();
  }
  
  localStorage.setItem('calc-history', JSON.stringify(calculationHistory));
  renderHistory();
}

// Render history list inside drawer
function renderHistory() {
  if (calculationHistory.length === 0) {
    historyList.innerHTML = '<p class="empty-msg">No calculation history yet.</p>';
    return;
  }

  historyList.innerHTML = calculationHistory.map((item, index) => `
    <div class="history-item" data-index="${index}">
      <div class="history-item-formula">${item.formula} =</div>
      <div class="history-item-result">${item.result}</div>
    </div>
  `).join('');

  // Add click listeners to history items
  document.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = el.getAttribute('data-index');
      const item = calculationHistory[idx];
      
      currentInput = item.result.toString();
      formulaBuffer = '';
      shouldResetDisplay = true;
      updateDisplay();
      toggleHistoryDrawer(false);
      playClickSound();
    });
  });
}

// Clear all history
clearHistoryBtn.addEventListener('click', () => {
  playClickSound();
  calculationHistory = [];
  localStorage.removeItem('calc-history');
  renderHistory();
});

// -------------------------------------------------------------
// CALCULATOR STATE & MATH ENGINE
// -------------------------------------------------------------

function inputDigit(digit) {
  if (currentInput === '0' || shouldResetDisplay) {
    currentInput = digit;
    shouldResetDisplay = false;
  } else {
    // Prevent digits exceeding max display width
    if (currentInput.length < 18) {
      currentInput += digit;
    }
  }
}

function inputDecimal() {
  if (shouldResetDisplay) {
    currentInput = '0.';
    shouldResetDisplay = false;
    return;
  }

  if (!currentInput.includes('.')) {
    currentInput += '.';
  }
}

function inputOperator(op) {
  // If we just completed a calculation (ends with '=') and press an operator,
  // chain the result with the new operator.
  if (formulaBuffer.trim().endsWith('=')) {
    formulaBuffer = currentInput + op;
    shouldResetDisplay = true;
    currentInput = '0';
    return;
  }

  // If we just clicked an operator and click another operator (override operator)
  if (shouldResetDisplay && formulaBuffer !== '') {
    const lastChar = formulaBuffer.trim().slice(-1);
    if (['+', '-', '*', '/'].includes(lastChar)) {
      // Replace the last operator
      formulaBuffer = formulaBuffer.trim().slice(0, -1) + op;
      return;
    }
  }

  // Standard behavior
  if (formulaBuffer !== '') {
    evaluateFormula(true); // chain evaluate
    formulaBuffer = currentInput + op;
  } else {
    formulaBuffer = currentInput + op;
  }
  currentInput = '0';
  shouldResetDisplay = true;
}

function clearAll() {
  formulaBuffer = '';
  currentInput = '0';
  lastResult = null;
  shouldResetDisplay = false;
}

function deleteLast() {
  if (shouldResetDisplay) {
    formulaBuffer = '';
    return;
  }
  
  if (currentInput.length > 1) {
    currentInput = currentInput.slice(0, -1);
  } else {
    currentInput = '0';
  }
}

function applyPercent() {
  // Directly divide current value by 100
  const val = parseFloat(currentInput);
  if (!isNaN(val)) {
    const res = val / 100;
    currentInput = formatNumber(res);
    shouldResetDisplay = true;
  }
}

function applyScientific(sciOp) {
  const val = parseFloat(currentInput);
  if (isNaN(val)) return;

  let result = 0;
  let label = '';

  switch (sciOp) {
    case 'sin':
      // Treat as degrees for default user intuitive usage
      result = Math.sin(val * Math.PI / 180);
      label = `sin(${val})`;
      break;
    case 'cos':
      result = Math.cos(val * Math.PI / 180);
      label = `cos(${val})`;
      break;
    case 'tan':
      result = Math.tan(val * Math.PI / 180);
      label = `tan(${val})`;
      break;
    case 'log':
      result = Math.log10(val);
      label = `log(${val})`;
      break;
    case 'ln':
      result = Math.log(val);
      label = `ln(${val})`;
      break;
    case 'sqrt':
      if (val < 0) {
        currentInput = 'NaN';
        updateDisplay();
        return;
      }
      result = Math.sqrt(val);
      label = `√(${val})`;
      break;
    case 'pow':
      // Standard custom exponential action
      formulaBuffer = `${currentInput} ** `;
      currentInput = '0';
      shouldResetDisplay = false;
      updateDisplay();
      return;
    case 'pi':
      currentInput = Math.PI.toString();
      updateDisplay();
      return;
  }

  // Format result
  const finalResult = formatNumber(result);
  
  // Set formula view
  formulaBuffer = label;
  currentInput = finalResult.toString();
  shouldResetDisplay = true;
  
  saveToHistory(formulaBuffer, currentInput);
  updateDisplay();
}

// Precision helper to eliminate floating point issues (e.g. 0.1 + 0.2)
function formatNumber(num) {
  if (isNaN(num)) return 'NaN';
  if (!isFinite(num)) return num.toString();

  // If scientific notation is triggered or floating point has minor dust, round off
  const precision = 12;
  const numStr = num.toPrecision(precision);
  
  // Parse back to float to remove trailing zeroes in floats
  return parseFloat(numStr).toString();
}

// Parse and evaluate equation
function evaluateFormula(isChain = false) {
  // If nothing is buffered, there is nothing to evaluate
  if (formulaBuffer === '') return;

  // Build expression to evaluate
  let expression = formulaBuffer;
  if (!shouldResetDisplay) {
    expression += currentInput;
  } else {
    // If we just clicked an operator and hit equal, evaluate what's inside formula
    // strip the trailing operator if any
    expression = expression.trim();
    if (['+', '-', '*', '/'].includes(expression.slice(-1))) {
      expression = expression.slice(0, -1);
    }
  }

  try {
    // Safe evaluation using simple parser/expression sanitization
    // Only allow digits, arithmetic symbols, spaces, parentheses, dots
    const sanitizedExpr = expression.replace(/[^0-9+\-*/().% ]/g, '');
    
    // Evaluate safely
    // Use Function constructor but only with sanitized string to prevent arbitrary code
    const result = new Function(`return (${sanitizedExpr})`)();
    
    const formattedResult = formatNumber(result);

    if (!isChain) {
      saveToHistory(expression, formattedResult);
      formulaBuffer = expression + ' =';
      currentInput = formattedResult.toString();
      shouldResetDisplay = true;
    } else {
      // Quiet chain evaluation simply updates the input value
      currentInput = formattedResult.toString();
    }
  } catch (error) {
    if (!isChain) {
      currentInput = 'NaN';
      shouldResetDisplay = true;
    }
  }
}

// -------------------------------------------------------------
// EVENT HANDLERS & MAPPINGS
// -------------------------------------------------------------

// Mouse / Touch keypad clicks
keypad.addEventListener('click', (e) => {
  const btn = e.target.closest('.key');
  if (!btn) return;

  // Synthesize sound
  playClickSound();

  const keyVal = btn.getAttribute('data-key') || btn.textContent.trim();
  handleInput(keyVal);
});

// Scientific panel clicks
scientificPanel.addEventListener('click', (e) => {
  const btn = e.target.closest('.sci-key');
  if (!btn) return;

  playClickSound();
  const sciOp = btn.getAttribute('data-key');
  applyScientific(sciOp);
});

// Main input router
function handleInput(key) {
  switch (key) {
    case 'Escape':
    case 'clr':
      clearAll();
      break;
    case 'Backspace':
    case 'DEL':
      deleteLast();
      break;
    case '%':
      applyPercent();
      break;
    case '/':
    case '*':
    case '-':
    case '+':
      inputOperator(key);
      break;
    case '.':
      inputDecimal();
      break;
    case '=':
    case 'Enter':
      evaluateFormula();
      break;
    default:
      // Must be a digit
      if (/^[0-9]$/.test(key)) {
        inputDigit(key);
      }
      break;
  }
  updateDisplay();
}

// -------------------------------------------------------------
// PHYSICAL KEYBOARD SUPPORT WITH TACTILE BUTTON REFLECTION
// -------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  let key = e.key;

  // Map keyboard keys to calculator equivalents
  if (key === 'Enter') key = '=';
  if (key === 'Escape') key = 'Escape'; // clr
  if (key === 'c' || key === 'C') key = 'Escape'; // alternate clear
  
  // Find key button on page to trigger physical press animation
  let querySelector = `.key[data-key="${key}"]`;
  if (key === 'Escape') querySelector = '.key[data-key="Escape"]';
  if (key === 'Backspace') querySelector = '.key[data-key="Backspace"]';
  
  const button = document.querySelector(querySelector);
  
  if (button) {
    e.preventDefault();
    button.classList.add('pressed');
    
    // Trigger action
    playClickSound();
    handleInput(key);

    // Remove pressed visual effect after short duration
    setTimeout(() => {
      button.classList.remove('pressed');
    }, 100);
  }
});

// Initialize configuration on load
initConfig();
updateDisplay();
