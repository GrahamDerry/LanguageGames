// Load the word frequency data (JSON file)
fetch('subtlex.json')
    .then(response => response.json())
    .then(data => {
        const freqDist = data;
        const words = Object.keys(freqDist);

        // Game variables
        let score = 0;
        let maxRankDifference = 30000; // Initial rank difference (easy level)
        const minRankDifference = 100; // Final difficulty level
        const totalSteps = 10; // Steps to decrease difficulty

        // Get DOM elements
        const word1Button = document.getElementById('word1');
        const word2Button = document.getElementById('word2');
        const resultDiv = document.getElementById('result');

        // Function to calculate the maxRankDifference exponentially
        function calculateMaxRankDifference(score) {
            const step = Math.min(score, totalSteps); // Ensure step doesn't exceed totalSteps
            const factor = Math.pow(minRankDifference / 30000, step / totalSteps);
            return Math.max(Math.floor(30000 * factor), minRankDifference);
        }

        // Function to get two random words with a rank difference <= maxRankDifference
        function getRandomWords() {
            let word1, word2;
            do {
                word1 = words[Math.floor(Math.random() * words.length)];
                word2 = words[Math.floor(Math.random() * words.length)];
            } while (
                word1 === word2 || 
                Math.abs(freqDist[word1] - freqDist[word2]) > maxRankDifference
            );
            return [word1, word2];
        }

        // Function to start a new round
        function newRound() {
            // Recalculate maxRankDifference
            maxRankDifference = calculateMaxRankDifference(score);
            console.log(`Debug: New maxRankDifference = ${maxRankDifference}`); // Debugging info

            const [word1, word2] = getRandomWords();
            const rank1 = freqDist[word1];
            const rank2 = freqDist[word2];

            word1Button.textContent = word1;
            word2Button.textContent = word2;

            word1Button.onclick = () => checkAnswer(rank1, rank2, 1);
            word2Button.onclick = () => checkAnswer(rank1, rank2, 2);

            resultDiv.textContent = ''; // Clear previous result
        }

        function checkAnswer(rank1, rank2, choice) {
            const correct = (choice === 1 && rank1 <= rank2) || (choice === 2 && rank2 <= rank1);

            if (correct) {
                resultDiv.classList.remove('game-over'); // Ensure no game-over styling
                resultDiv.innerHTML = `
                    <p class="correct">Correct! Your score: ${score + 1}</p>
                    <p>Rank of '${word1Button.textContent}': ${rank1}</p>
                    <p>Rank of '${word2Button.textContent}': ${rank2}</p>
                `;
                score++;
                setTimeout(newRound, 3000); // Start a new round after delay
            } else {
                resultDiv.classList.add('game-over'); // Add game-over styling
                resultDiv.innerHTML = `
                    <p>Game Over! Final score: ${score}</p>
                    <p>Rank of '${word1Button.textContent}': ${rank1}</p>
                    <p>Rank of '${word2Button.textContent}': ${rank2}</p>
                `;

                // Disable buttons after game over
                word1Button.onclick = null;
                word2Button.onclick = null;
            }
        }

        // Start the first round
        newRound();
    })
    .catch(error => console.error('Error loading frequency data:', error));
