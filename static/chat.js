document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const agentSelect = document.getElementById('agent-select');
    
    // Fetch agents from backend and populate dropdown
    fetchAgents();
    
    // Add welcome message
    addMessage({ text: 'Hello! I am your AI assistant. How can I help you today?', is_image: false }, false);
    
    // Handle send button click
    sendButton.addEventListener('click', sendMessage);
    
    // Handle Enter key press (without Shift for new line)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Function to fetch agents from backend
    async function fetchAgents() {
        try {
            const response = await fetch('/agents');
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    // Clear existing options
                    agentSelect.innerHTML = '';
                    
                    // Add default option
                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = 'Select an Agent';
                    agentSelect.appendChild(defaultOption);
                    
                    // Add agents from database
                    data.data.forEach(agent => {
                        const option = document.createElement('option');
                        option.value = agent.username;
                        option.textContent = agent.name || agent.username;
                        agentSelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching agents:', error);
        }
    }
    
    // Function to send message
    async function sendMessage() {
        const message = userInput.value.trim();
        if (message) {
            // Add user message to chat
            addMessage(message, true);
            
            // Clear input
            userInput.value = '';
            
            // Disable input and button while waiting for response
            userInput.disabled = true;
            sendButton.disabled = true;
            
            // Show typing indicator
            showTypingIndicator();
            
            try {
                // Get selected agent
                const selectedAgent = agentSelect.value;
                
                // Determine endpoint based on selected agent
                let endpoint = '/generate-text';
                if (selectedAgent === 'midjourney') {
                    endpoint = '/generate';
                } else if (selectedAgent === 'workflow') {
                    endpoint = '/run-workflow';
                }
                
                // Send message to backend
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        prompt: message,
                        agent_username: selectedAgent
                    })
                });
                
                // Hide typing indicator
                hideTypingIndicator();
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        // Add agent response to chat
                        addMessage(data.data, false);
                    } else {
                        // Handle error
                        addMessage({ text: `Error: ${data.error}`, is_image: false }, false);
                    }
                } else {
                    // Handle HTTP error
                    addMessage({ text: 'Error: Failed to get response from server', is_image: false }, false);
                }
            } catch (error) {
                // Hide typing indicator
                hideTypingIndicator();
                
                // Handle network error
                addMessage({ text: `Error: ${error.message}`, is_image: false }, false);
            }
            
            // Re-enable input and button
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.focus();
        }
    }
    
    // Function to add message to chat
    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        
        if (isUser) {
            // User message is just text
            messageDiv.textContent = message;
        } else {
            // Bot message might contain text and/or image
            if (message.is_image) {
                // Create a container for the image response
                const imageContainer = document.createElement('div');
                imageContainer.className = 'image-response';
                
                // Add the text message
                const textDiv = document.createElement('div');
                textDiv.className = 'message-text';
                textDiv.textContent = message.text;
                imageContainer.appendChild(textDiv);
                
                // Add the image
                const img = document.createElement('img');
                img.src = message.image_url;
                img.alt = 'Generated image';
                img.className = 'generated-image';
                imageContainer.appendChild(img);
                
                messageDiv.appendChild(imageContainer);
            } else {
                // Regular text message
                messageDiv.textContent = message.text;
            }
        }
        
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to show typing indicator
    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';
        
        chatMessages.appendChild(typingDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to hide typing indicator
    function hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
}); 