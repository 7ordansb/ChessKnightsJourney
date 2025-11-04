// main.js - The entry point that initializes everything
import { renderBoard, renderDeckViewer, updateGameObjectPositions, renderPlayerHand, renderHealth } from './src/ui.js';
import { gameState, movePlayer, useCard, clearSelection } from './src/state.js';
import { calculateValidMoves } from './src/logic.js';

// Function to handle card selection
function handleCardSelection(cardInstanceId) {
  // If no actions remain, start a new turn (this happens when player selects a card after their turn has ended)
  if (gameState.actionsRemaining <= 0) {
    // This means the previous turn ended, so we start a new turn
    // In a full game, this would be handled differently, but for this implementation:
    gameState.actionsRemaining = 1;
    console.log('Starting new turn');
  }
  
  // Check if player has actions remaining
  if (gameState.actionsRemaining <= 0) {
    return; // Player can't select a card if no actions remaining
  }
  
  // Find the card in the hand by its unique instance ID
  const card = gameState.hand.find(c => c.card_id === cardInstanceId);
  if (!card) return; // If card not found, return early
  
  // Update the selected card in the game state with the card object
 gameState.selectedCard = card;
  
  // Get the player's current position
  const player = gameState.gameObjects.find(obj => obj.type === 'player');
  if (player) {
    // Calculate valid moves based on the selected card and player's position
    gameState.highlightedSquares = calculateValidMoves({row: player.row, col: player.col}, card);
  } else {
    // If no player found, clear highlights
    gameState.highlightedSquares = [];
  }
  
  // Re-render the board to update highlights
 renderBoard();
}

// Function to handle the end of a player action
function endPlayerAction() {
  // Decrement the actions remaining
  gameState.actionsRemaining--;
  
  // Check if the played card had the stamina upgrade
  if (gameState.selectedCard && gameState.selectedCard.upgrades) {
    const hasStaminaUpgrade = gameState.selectedCard.upgrades.some(upgrade => upgrade.id === 'stamina_1');
    if (hasStaminaUpgrade) {
      // If the card has stamina upgrade, increment actions remaining
      gameState.actionsRemaining++;
    }
  }
  
  // Check if actions are remaining
  if (gameState.actionsRemaining <= 0) {
    // No actions remaining, end the turn
    console.log('Player turn ended');
    // In the future, this is where enemy turns would begin
  } else {
    // Actions remaining, player can continue
    console.log(`Player has ${gameState.actionsRemaining} action(s) remaining`);
  }
}
// Function to aggregate deck data
function getDeckCards() {
  // Combine all cards from deck, hand, and discard pile into a flat array
  // NOTE: Do not include nextCard as it's just a preview of the top card in the deck
  const allCards = [
    ...gameState.deck,
    ...gameState.hand,
    ...gameState.discardPile
 ];
  
  // Group cards by type
  const groupedCards = {};
  allCards.forEach(card => {
    const cardType = card.name; // Use the card name as the type
    if (!groupedCards[cardType]) {
      groupedCards[cardType] = [];
    }
    groupedCards[cardType].push(card);
  });
  
  return groupedCards;
}

// Function to show the deck viewer modal
function showDeckViewer() {
  // Get the flat array of all cards
  const allCards = getDeckCards();
  
  // Render the deck viewer
  renderDeckViewer(allCards);
  
  // Show the modal
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.style.display = 'flex';
  }
}

// Function to hide the deck viewer modal
function hideDeckViewer() {
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) {
    modalOverlay.style.display = 'none';
  }
}

// Initialize the game
function initGame() {
  // The board is rendered automatically when ui.js is imported
  console.log('Chess Knight\'s Journey initialized!');
  
  // Add click listeners to the card buttons after the DOM is loaded
 // We need to use event delegation since cards are dynamically created
  document.addEventListener('click', function(event) {
    if (event.target.classList.contains('card-button') || event.target.closest('.card-button')) {
      const cardButton = event.target.classList.contains('card-button') ? event.target : event.target.closest('.card-button');
      const cardInstanceId = cardButton.dataset.cardId;
      if (cardInstanceId) {
        handleCardSelection(cardInstanceId);
      }
    }
  });

  // Add click listener for the deck button
  document.addEventListener('click', function(event) {
    if (event.target.classList.contains('deck-button') || event.target.closest('.deck-button')) {
      showDeckViewer();
    }
  });

  // Add click listener to close the modal when clicking the overlay
  document.addEventListener('click', function(event) {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay && event.target === modalOverlay) {
      hideDeckViewer();
    }
  });

  // Add click listener to close the modal with the close button
  document.addEventListener('click', function(event) {
    if (event.target.classList.contains('close-modal') || event.target.closest('.close-modal')) {
      hideDeckViewer();
    }
  });

  // Add click listener to the board for moving the player
     document.addEventListener('click', function(event) {
       // Only process click if it's on a square (but not on the game object icons themselves)
       const square = event.target.classList.contains('square') ? event.target : event.target.closest('.square');
       if (square && gameState.selectedCard) {
         // Prevent clicks on game objects (player/enemy icons) from triggering moves
         if (event.target.classList.contains('game-object')) {
           return;
         }
         
         const row = parseInt(square.dataset.row);
         const col = parseInt(square.dataset.col);
         
         // Check if the clicked square is in the highlighted squares (valid move)
         const isValidMove = gameState.highlightedSquares.some(square =>
           square.row === row && square.col === col
         );
         
         if (isValidMove && gameState.actionsRemaining > 0) {
           // Clear only the highlighted squares immediately when a move is made, but keep the selected card for later processing
           gameState.highlightedSquares = [];
           renderBoard(); // Re-render the board to remove highlights immediately
           
           // Move the player to the new position
           const player = gameState.gameObjects.find(obj => obj.type === 'player');
           if (player) {
             // Store the starting position for potential reverse upgrade
             const startPosition = { row: player.row, col: player.col };
             
             // Check if the destination square has an enemy
             const enemyIndex = gameState.enemies.findIndex(enemy => enemy.row === row && enemy.col === col);
             
             // Update the player's position in the state
             player.row = row;
             player.col = col;
             
             // Update the position of game objects without re-rendering the whole board
             updateGameObjectPositions();
             
             // Check for Reverse upgrade effect
             if (gameState.selectedCard && gameState.selectedCard.upgrades) {
               const hasReverseUpgrade = gameState.selectedCard.upgrades.some(upgrade => upgrade.id === 'reverse_1');
               if (hasReverseUpgrade) {
                 // Wait for the movement animation to complete before handling the reverse effect
                 setTimeout(() => {
                   // Remove the enemy from the state (since player moved there and then will move back)
                   if (enemyIndex !== -1) {
                     gameState.enemies.splice(enemyIndex, 1);
                     console.log('Enemy captured!');
                   }
                   
                   // Use the selected card and reorder the player's hand
                   if (gameState.selectedCard) {
                     useCard(gameState.selectedCard.card_id); // Use the unique card instance ID
                   }
                   
                   // Move player back to starting position
                   player.row = startPosition.row;
                   player.col = startPosition.col;
                   
                   // Update the position of game objects without re-rendering the whole board
                   updateGameObjectPositions();
                   
                   // Check for Armor upgrade effect (after the reverse movement)
                   if (gameState.selectedCard && gameState.selectedCard.upgrades) {
                     const hasArmorUpgrade = gameState.selectedCard.upgrades.some(upgrade => upgrade.id === 'armor_1');
                     if (hasArmorUpgrade) {
                       // Increment player armor by 1
                       gameState.playerArmor++;
                       console.log('Armor upgrade activated - gained 1 armor point!');
                     }
                   }
                   
                   // Clear the selected card and highlighted squares (should already be clear but just to be safe)
                   clearSelection();
                   
                   // Handle the end of player action (check for stamina upgrade, etc.)
                   endPlayerAction();
                   
                   // Update the UI elements that need updating
                   renderPlayerHand();
                   renderHealth();
                   
                   console.log('Reverse upgrade activated - player returned to starting position!');
                 }, 300); // Wait for the movement animation to complete (0.3s)
               } else {
                 // Regular move (not reverse)
                 // Wait for the movement animation to complete before handling the capture
                 setTimeout(() => {
                   // Remove the enemy from the state
                   if (enemyIndex !== -1) {
                     gameState.enemies.splice(enemyIndex, 1);
                     console.log('Enemy captured!');
                   }
                   
                   // Use the selected card and reorder the player's hand
                   if (gameState.selectedCard) {
                     useCard(gameState.selectedCard.card_id); // Use the unique card instance ID
                   }
                   
                   // Check for Armor upgrade effect
                   if (gameState.selectedCard && gameState.selectedCard.upgrades) {
                     const hasArmorUpgrade = gameState.selectedCard.upgrades.some(upgrade => upgrade.id === 'armor_1');
                     if (hasArmorUpgrade) {
                       // Increment player armor by 1
                       gameState.playerArmor++;
                       console.log('Armor upgrade activated - gained 1 armor point!');
                     }
                   }
                   
                   // Clear the selected card and highlighted squares (should already be clear but just to be safe)
                   clearSelection();
                   
                   // Handle the end of player action (check for stamina upgrade, etc.)
                   endPlayerAction();
                   
                   // Update the UI elements that need updating
                   renderPlayerHand();
                   renderHealth();
                 }, 30); // Wait for the movement animation to complete (0.3s)
               }
             } else {
               // Non-upgrade move (no reverse)
               // Wait for the movement animation to complete before handling the capture
               setTimeout(() => {
                 // Remove the enemy from the state
                 if (enemyIndex !== -1) {
                   gameState.enemies.splice(enemyIndex, 1);
                   console.log('Enemy captured!');
                 }
                 
                 // Use the selected card and reorder the player's hand
                 if (gameState.selectedCard) {
                   useCard(gameState.selectedCard.card_id); // Use the unique card instance ID
                 }
                 
                 // Check for Armor upgrade effect
                 if (gameState.selectedCard && gameState.selectedCard.upgrades) {
                   const hasArmorUpgrade = gameState.selectedCard.upgrades.some(upgrade => upgrade.id === 'armor_1');
                   if (hasArmorUpgrade) {
                     // Increment player armor by 1
                     gameState.playerArmor++;
                     console.log('Armor upgrade activated - gained 1 armor point!');
                   }
                 }
                 
                   // Clear the selected card and highlighted squares (should already be clear but just to be safe)
                   clearSelection();
                   
                   // Handle the end of player action (check for stamina upgrade, etc.)
                   endPlayerAction();
                   
                   // Update the UI elements that need updating
                   renderPlayerHand();
                   renderHealth();
               }, 300); // Wait for the movement animation to complete (0.3s)
             }
           }
         }
       }
     });
   }

// Start the game when the page loads
document.addEventListener('DOMContentLoaded', initGame);

/*
 * To run this application, you'll need to serve it using a local server
 * due to browser security restrictions with ES6 modules.
 *
 * You can start a local server using one of these commands:
 *
 * Using npx serve:
 * npx serve
 *
 * Or using Python (if you have Python installed):
 * python -m http.server (for Python 3.x)
 * python -m SimpleHTTPServer (for Python 2.x)
 *
 * Then open your browser and navigate to the provided address.
 */