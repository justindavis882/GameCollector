const LEADERBOARD_URL = "https://script.google.com/macros/s/AKfycbxC3TNayRCPd8d2xxIC3VkIUWypTpBuHnJcmTmGuiGYs6u_2PTdJMmYillauMfz0axAxQ/exec";
let topScores = [];

const canvas = document.getElementById("gameBoard");
const ctx = canvas.getContext("2d");

let score = 100; 
let level = 1;

let board = [];

const gridSize = 8;
let tileSize; // Changed from const to let so we can update it on resize

// Store the button's location and size
let resetBtn = { x: 0, y: 0, w: 120, h: 40 };

function resizeGame() {
    canvas.width = window.innerWidth * 0.95;
    canvas.height = window.innerHeight * 0.85;

    // INCREASED to 300 to leave enough room for your text panel
    let availableBoardWidth = canvas.width - 300; 
    
    tileSize = Math.min(availableBoardWidth, canvas.height) / gridSize;
    
    if (board && board.length > 0) {
        drawBoard(); 
    }
}

// Run this immediately, and anytime the screen is resized or rotated
window.addEventListener("resize", resizeGame);
resizeGame();

const jewelColors = [
    "red.png", 
    "orange.png", 
    "yellow.png", 
    "green.png", 
    "blue.png", 
    "purple.png"
];

// Special asset variable
const bombAsset = "bomb.png";

// Object to hold our ready-to-use images
const jewelAssets = {};
let assetsLoaded = 0;

let shakeTime = 0;

function applyScreenShake(duration) {
    shakeTime = duration;
}

let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener("touchstart", function(e) {
    e.preventDefault(); // Stop scrolling
    let rect = canvas.getBoundingClientRect();
    touchStartX = e.touches[0].clientX - rect.left;
    touchStartY = e.touches[0].clientY - rect.top;
    
    // Check if the touch is inside the bounds of the reset button
    if (touchStartX >= resetBtn.x && touchStartX <= resetBtn.x + resetBtn.w &&
        touchStartY >= resetBtn.y && touchStartY <= resetBtn.y + resetBtn.h) {
        resetGame();
        return; // Stop running the rest of the function
    }
    
    // Select the first gem
    let col = Math.floor(touchStartX / tileSize);
    let row = Math.floor(touchStartY / tileSize);
    handlePlayerClick(row, col); 
}, {passive: false});

canvas.addEventListener("touchstart", function(e) {
    e.preventDefault(); // Stop scrolling
    let rect = canvas.getBoundingClientRect();
    touchStartX = e.touches[0].clientX - rect.left;
    touchStartY = e.touches[0].clientY - rect.top;
    
    // Select the first gem
    let col = Math.floor(touchStartX / tileSize);
    let row = Math.floor(touchStartY / tileSize);
    handlePlayerClick(row, col); 
}, {passive: false});

canvas.addEventListener("touchend", function(e) {
    let rect = canvas.getBoundingClientRect();
    let touchEndX = e.changedTouches[0].clientX - rect.left;
    let touchEndY = e.changedTouches[0].clientY - rect.top;
    
    let dx = touchEndX - touchStartX;
    let dy = touchEndY - touchStartY;
    
    // Determine swipe direction and trigger the second click
    let startCol = Math.floor(touchStartX / tileSize);
    let startRow = Math.floor(touchStartY / tileSize);
    
    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe
        if (dx > 30) handlePlayerClick(startRow, startCol + 1); // Right
        else if (dx < -30) handlePlayerClick(startRow, startCol - 1); // Left
    } else {
        // Vertical swipe
        if (dy > 30) handlePlayerClick(startRow + 1, startCol); // Down
        else if (dy < -30) handlePlayerClick(startRow - 1, startCol); // Up
    }
});

// Web Audio API Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'swap') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'match') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'penalty') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'explosion') {
        // A chaotic, descending burst for bombs!
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.4);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
    }
}

function speakLevelUp() {
    // Check if the browser supports speech synthesis
    if ('speechSynthesis' in window) {
        let announcement = new SpeechSynthesisUtterance("Level Up!");
        
        // Tweak these values to change how the voice sounds!
        announcement.pitch = 1.5; // 1 is normal, higher is squeakier
        announcement.rate = 1.2;  // 1 is normal, higher is faster
        announcement.volume = 0.8; 
        
        window.speechSynthesis.speak(announcement);
    }
}

// Spawns a random color, with a 3% chance to spawn a bomb instead
function getRandomGem() {
    if (Math.random() < 0.03) return bombAsset;
    return jewelColors[Math.floor(Math.random() * jewelColors.length)];
}

function createBoard() {
    board = []; 
    for (let row = 0; row < gridSize; row++) {
        let newRow = [];
        for (let col = 0; col < gridSize; col++) {
            newRow.push(getRandomGem());
        }
        board.push(newRow);
    }
}

function initGame() {
    createBoard();

    // Combine standard colors and the bomb for preloading
    let allAssets = [...jewelColors, bombAsset];

    allAssets.forEach(color => {
        let img = new Image();
        img.src = color;
        img.onload = function() {
            jewelAssets[color] = img;
            assetsLoaded++;
            if (assetsLoaded === allAssets.length) {
                drawBoard();
            }
        };
    });
}

function drawBoard() {
	ctx.save(); // Save default state
    
    if (shakeTime > 0) {
        let dx = (Math.random() - 0.5) * 10; // 10px max shake
        let dy = (Math.random() - 0.5) * 10;
        ctx.translate(dx, dy);
        shakeTime--;
    }
	
    ctx.clearRect(0, 0, canvas.width, canvas.height); 

    ctx.strokeStyle = "#ffffff"; 
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, gridSize * tileSize, gridSize * tileSize);
    ctx.lineWidth = 1; 

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            let gemColor = board[row][col];
            if (gemColor !== "empty" && jewelAssets[gemColor]) {
                ctx.drawImage(jewelAssets[gemColor], col * tileSize, row * tileSize, tileSize, tileSize);
            }
        }
    }

    let uiXPosition = (gridSize * tileSize) + 20; 

    // --- 1. Draw the Themed Game Title ---
    ctx.save(); // Save canvas state so shadows don't leak to other elements
    ctx.font = "bold 38px 'Segoe UI', Impact, sans-serif"; 
    
    // Create a glossy gradient for the text
    let titleGrad = ctx.createLinearGradient(uiXPosition, 10, uiXPosition, 45);
    titleGrad.addColorStop(0, "#FEE140"); // Bright yellow top
    titleGrad.addColorStop(1, "#FA709A"); // Pinkish-orange bottom
    
    // Add a dark drop shadow for depth
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillStyle = titleGrad;
    ctx.fillText("Gem Clash", uiXPosition, 45);
    
    // Add a crisp white outline to make the letters pop
    ctx.shadowColor = "transparent"; // Turn off shadow for the outline
    ctx.lineWidth = 1;
    ctx.strokeStyle = "white";
    ctx.strokeText("Gem Clash", uiXPosition, 45);
    ctx.restore(); // Reset canvas state


    // --- 2. Draw the Themed Reset Button ---
    resetBtn.x = uiXPosition;
    resetBtn.y = 70; // Shifted down slightly because the title is bigger
    resetBtn.w = 140; 
    resetBtn.h = 45;

    ctx.save();
    // Button drop shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 4;

    // Jewel-toned button gradient (Cyan to Deep Blue)
    let btnGrad = ctx.createLinearGradient(resetBtn.x, resetBtn.y, resetBtn.x, resetBtn.y + resetBtn.h);
    btnGrad.addColorStop(0, "#00c6ff");
    btnGrad.addColorStop(1, "#0072ff");

    ctx.fillStyle = btnGrad;
    ctx.beginPath();
    // Use roundRect for smooth, app-like button corners (12px radius)
    ctx.roundRect(resetBtn.x, resetBtn.y, resetBtn.w, resetBtn.h, 12); 
    ctx.fill();

    // Add a semi-transparent glass rim highlight
    ctx.shadowColor = "transparent"; 
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Centered Button Text
    ctx.fillStyle = "white";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";   // Aligns horizontally to the exact center
    ctx.textBaseline = "middle"; // Aligns vertically
    // Draw text exactly in the middle of our button's width and height
    ctx.fillText("RESTART", resetBtn.x + (resetBtn.w / 2), resetBtn.y + (resetBtn.h / 2));
    ctx.restore();

    // 3. Draw Score and Level (Shifted down to make room)
    ctx.fillStyle = "white";
    ctx.font = "bold 24px Arial";
    ctx.fillText("Score: " + score, uiXPosition, 140);
    ctx.fillText("Level: " + level, uiXPosition, 180);
	
	// 4. Draw Instructions Panel (The Shaded Window)
    let panelX = uiXPosition;
    let panelY = 220;
    let panelWidth = 270; // Width of the shaded box
    let panelHeight = 240; // Height of the shaded box

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; // Black with 40% opacity for shading
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 10); // 10px rounded corners
    ctx.fill();

    // 5. Draw the text inside the window
    ctx.fillStyle = "white";
    ctx.font = "14px Arial"; // Shrunk the font so it fits inside the panel
    
    // Break the text into an array so it fits inside the panel width
    let instructions = [
        "Your objective is to build matches",
        "of 3 or more like-colored gems.",
        "", // Blank line for spacing
        "• Destroying a gem: +10 points",
        "• Swapping a gem: -10 points",
        "• Bombs randomly spawn on match",
        "• Bomb + Gem = Destroy that color",
        "• Bomb + Bomb = Destroy full board",
        "• Game ends when score drops < 0"
    ];

    let lineY = panelY + 30; // Start the text slightly inside the top of the box
    
    // Loop through the array and draw each line perfectly spaced
    for (let i = 0; i < instructions.length; i++) {
        ctx.fillText(instructions[i], panelX + 15, lineY); // +15 creates a left margin inside the box
        lineY += 22; // Move down 22 pixels for the next line
    }
	
	// --- 6. Draw the Leaderboard Panel ---
    // Anchor this to the far right side of the screen
    let lbX = canvas.width - 220; 
    let lbY = 40;
    let lbWidth = 200;
    
    // Draw the shaded background panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(lbX, lbY, lbWidth, 240, 10);
    ctx.fill();

    // Draw the Header
    ctx.fillStyle = "#FEE140"; // Match the gold from the title
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("HIGH SCORES", lbX + (lbWidth / 2), lbY + 35);

    // Draw the Data
    ctx.fillStyle = "white";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "left"; // Reset alignment for the list
    
    let scoreY = lbY + 75;
    
    if (topScores.length === 0) {
        ctx.fillText("Loading...", lbX + 20, scoreY);
    } else {
        for (let i = 0; i < topScores.length; i++) {
            // Draw Rank & Initials on the left
            ctx.fillText(`${i + 1}.  ${topScores[i].initials}`, lbX + 20, scoreY);
            
            // Draw Score right-aligned
            ctx.textAlign = "right";
            ctx.fillText(topScores[i].score, lbX + lbWidth - 20, scoreY);
            
            ctx.textAlign = "left"; // Reset for the next loop
            scoreY += 35; // Space out the rows
        }
    }
}

function animateMatchPop(cells, callback) {
    let startTime = null;
    let duration = 200; 

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = (timestamp - startTime) / duration;
        if (progress > 1) progress = 1;

        drawBoard(); 

        cells.forEach(cell => {
            let r = cell.r;
            let c = cell.c;
            let color = board[r][c];
            if (color !== "empty" && jewelAssets[color]) {
                let size = tileSize * (1 - progress); 
                let offset = (tileSize - size) / 2; 
                ctx.drawImage(jewelAssets[color], c * tileSize + offset, r * tileSize + offset, size, size);
            }
        });

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            callback();
        }
    }
    window.requestAnimationFrame(step);
}

function animateSwap(r1, c1, r2, c2, callback) {
    let startTime = null;
    let duration = 250; 

    let img1 = jewelAssets[board[r1][c1]];
    let img2 = jewelAssets[board[r2][c2]];

    let temp1 = board[r1][c1];
    let temp2 = board[r2][c2];
    board[r1][c1] = "empty";
    board[r2][c2] = "empty";

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = (timestamp - startTime) / duration;
        if (progress > 1) progress = 1;

        drawBoard(); 

        let currX1 = c1 * tileSize + (c2 - c1) * tileSize * progress;
        let currY1 = r1 * tileSize + (r2 - r1) * tileSize * progress;
        let currX2 = c2 * tileSize + (c1 - c2) * tileSize * progress;
        let currY2 = r2 * tileSize + (r1 - r2) * tileSize * progress;

        ctx.drawImage(img1, currX1, currY1, tileSize, tileSize);
        ctx.drawImage(img2, currX2, currY2, tileSize, tileSize);

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            board[r2][c2] = temp1;
            board[r1][c1] = temp2;
            callback();
        }
    }

    window.requestAnimationFrame(step);
}

let firstClick = null;

function handlePlayerClick(row, col) {
    if (row >= gridSize || col >= gridSize) return;

    if (firstClick === null) {
        firstClick = { row: row, col: col };
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.strokeRect(col * tileSize, row * tileSize, tileSize, tileSize);
        ctx.lineWidth = 1;
    } else {
        let secondClick = { row: row, col: col };
        let isAdjacent = Math.abs(firstClick.row - secondClick.row) + Math.abs(firstClick.col - secondClick.col) === 1;

        if (isAdjacent) {
            playSound('swap');
            
            // Capture coordinates locally before firstClick gets erased
            let r1 = firstClick.row;
            let c1 = firstClick.col;
            let r2 = secondClick.row;
            let c2 = secondClick.col;
            
            let item1 = board[r1][c1];
            let item2 = board[r2][c2];
            
            animateSwap(r1, c1, r2, c2, function() {
                let isBomb1 = item1 === bombAsset;
                let isBomb2 = item2 === bombAsset;

                if (isBomb1 && isBomb2) {
                    triggerBoardClear();
                } else if (isBomb1 || isBomb2) {
                    let targetColor = isBomb1 ? item2 : item1;
                    
                    if (targetColor !== "empty") {
                        // Pass the safe local coordinates instead of the objects
                        triggerColorClear(targetColor, r1, c1, r2, c2);
                    } else {
                        drawBoard();
                        checkMatches();
                    }
                } else {
                    score -= 10;
                    drawBoard();
                    checkGameOver(); 
                    checkMatches();
                }
            });
        } else {
            drawBoard(); 
        }
        
        // This resets the global click, but our local r1/c1 are safe!
        firstClick = null;
    }
}

// Helper to destroy a specific color
// Helper to destroy a specific color
function triggerColorClear(targetColor, r1, c1, r2, c2) {
    playSound('explosion');
    
    // Add the two swapped gems to the destruction list
    let cellsToClear = [{r: r1, c: c1}, {r: r2, c: c2}];
    
    // Find all matching colors on the board
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (board[r][c] === targetColor) {
                // Ensure we don't push duplicates of the original two cells
                if (!(r === r1 && c === c1) && !(r === r2 && c === c2)) {
                    cellsToClear.push({r: r, c: c});
                }
            }
        }
    }
    executeSpecialClear(cellsToClear);
}

// Helper to destroy everything
function triggerBoardClear() {
    playSound('explosion');
    let cellsToClear = [];
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (board[r][c] !== "empty") {
                cellsToClear.push({r: r, c: c});
            }
        }
    }
    executeSpecialClear(cellsToClear);
}

// Executes the pop animation and handles the score/refill for bombs
function executeSpecialClear(cells) {
    let pointsEarned = cells.length * 10;
    score += pointsEarned;
    
    animateMatchPop(cells, function() {
        cells.forEach(cell => { board[cell.r][cell.c] = "empty"; });

        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (board[r][c] === "empty") {
                    board[r][c] = getRandomGem();
                }
            }
        }
        drawBoard();
        setTimeout(checkMatches, 150); 
    });
}

function checkGameOver() {
    if (score < 0) {
        setTimeout(function() {
            // Use a standard browser prompt for capturing text in an HTML5 Canvas game
            let initials = prompt(`Game Over! You sorted through ${level} levels.\n\nEnter 3 Initials for the Leaderboard:`, "AAA");
            
            if (initials) {
                submitScore(initials, score); // Assuming you want to save the highest score they achieved, you might want to track a 'maxScore' variable instead of the current score which is < 0.
            }
            
            resetGame();
        }, 50);
    }
}

function checkMatches() {
    let matchedCells = [];

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize - 2; c++) {
            let item1 = board[r][c];
            // Exclude empty spots AND bombs from accidentally matching in normal lines of 3
            if (item1 !== "empty" && item1 !== bombAsset && item1 === board[r][c + 1] && item1 === board[r][c + 2]) {
                matchedCells.push({ r: r, c: c }, { r: r, c: c + 1 }, { r: r, c: c + 2 });
            }
        }
    }

    for (let c = 0; c < gridSize; c++) {
        for (let r = 0; r < gridSize - 2; r++) {
            let item1 = board[r][c];
            if (item1 !== "empty" && item1 !== bombAsset && item1 === board[r + 1][c] && item1 === board[r + 2][c]) {
                matchedCells.push({ r: r, c: c }, { r: r + 1, c: c }, { r: r + 2, c: c });
            }
        }
    }

    if (matchedCells.length > 0) {
        playSound('match'); 
        let pointsEarned = matchedCells.length * 10;
        score += pointsEarned;
        
        let uniqueCells = [];
        let seen = new Set();
        matchedCells.forEach(cell => {
            let key = cell.r + "," + cell.c;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueCells.push(cell);
            }
        });

        animateMatchPop(uniqueCells, function() {
            uniqueCells.forEach(cell => { board[cell.r][cell.c] = "empty"; });

            for (let r = 0; r < gridSize; r++) {
                for (let c = 0; c < gridSize; c++) {
                    if (board[r][c] === "empty") {
                        board[r][c] = getRandomGem(); 
                    }
                }
            }
            drawBoard();
            setTimeout(checkMatches, 150); 
        });
    }
    
    if (score > level * 1000) {
        level += 1;
		speakLevelUp();
    }
}

function resetGame() {
    score = 100;
    level = 1;
    createBoard();
    drawBoard();
}

canvas.addEventListener("mousedown", function(event) {
    let mouseX = event.offsetX;
    let mouseY = event.offsetY;

    // Check if the click is inside the bounds of the reset button
    if (mouseX >= resetBtn.x && mouseX <= resetBtn.x + resetBtn.w &&
        mouseY >= resetBtn.y && mouseY <= resetBtn.y + resetBtn.h) {
        resetGame();
        return; // Stop running the rest of the function
    }

    // Otherwise, treat it as a normal gem click
    let col = Math.floor(mouseX / tileSize);
    let row = Math.floor(mouseY / tileSize);
    handlePlayerClick(row, col); 
});

// Fetch the scores when the game loads
async function loadLeaderboard() {
    try {
        const response = await fetch(LEADERBOARD_URL);
        topScores = await response.json();
        drawBoard(); // Redraw the canvas to show the new scores
    } catch (error) {
        console.error("Failed to load leaderboard", error);
    }
}

// Send a score at Game Over
async function submitScore(initials, finalScore) {
    try {
        await fetch(LEADERBOARD_URL, {
            method: 'POST',
            body: JSON.stringify({ initials: initials, score: finalScore })
        });
        loadLeaderboard(); // Refresh the board after submitting
    } catch (error) {
        console.error("Failed to submit score", error);
    }
}

// Call this at the very bottom of script.js to load scores immediately
loadLeaderboard();

initGame();