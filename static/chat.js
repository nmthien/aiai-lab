document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const agentList = document.getElementById('agent-list');
    const currentAgentTitle = document.getElementById('current-agent');
    
    // Store chat histories for each agent
    const chatHistories = new Map();
    let currentAgent = null;
    
    // Fetch agents from backend and populate sidebar
    fetchAgents();
    
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
                    // Clear existing agents
                    agentList.innerHTML = '';
                    
                    // Add agents to sidebar
                    data.data.forEach(agent => {
                        const agentItem = document.createElement('div');
                        agentItem.className = 'agent-item';
                        agentItem.dataset.username = agent.username;
                        agentItem.textContent = agent.name || agent.username;
                        agentItem.addEventListener('click', () => selectAgent(agent));
                        agentList.appendChild(agentItem);
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching agents:', error);
        }
    }
    
    // Function to select an agent
    async function selectAgent(agent) {
        // Update current agent
        currentAgent = agent;
        currentAgentTitle.textContent = agent.name || agent.username;
        
        // Update active state in sidebar
        document.querySelectorAll('.agent-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.username === agent.username) {
                item.classList.add('active');
            }
        });
        
        // Clear chat messages
        chatMessages.innerHTML = '';
        
        // If this is the first time selecting this agent, get their greeting
        if (!chatHistories.has(agent.username)) {
            // Disable input and button while waiting for greeting
            userInput.disabled = true;
            sendButton.disabled = true;
            
            chatHistories.set(agent.username, []);
            await getAgentGreeting(agent);
            
            // Re-enable input and button after greeting
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.focus();
        } else {
            // Display existing chat history
            const history = chatHistories.get(agent.username);
            for (const message of history) {
                // Check if the message has an isUser property
                const isUser = message.isUser === true;
                addMessage(message, isUser);
            }
        }
    }
    
    // Function to get agent's greeting
    async function getAgentGreeting(agent) {
        try {
            // Show typing indicator
            showTypingIndicator();
            
            const response = await fetch('/generate-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: "Please introduce yourself briefly.",
                    agent_username: agent.username
                })
            });
            
            // Hide typing indicator
            hideTypingIndicator();
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    const greeting = data.data;
                    addMessage(greeting, false);
                    chatHistories.get(agent.username).push(greeting);
                } else {
                    // Handle error
                    const errorMessage = { text: `Error: ${data.error}`, is_image: false, isUser: false };
                    addMessage(errorMessage, false);
                    chatHistories.get(agent.username).push(errorMessage);
                }
            } else {
                // Handle HTTP error
                const errorMessage = { text: 'Error: Failed to get response from server', is_image: false, isUser: false };
                addMessage(errorMessage, false);
                chatHistories.get(agent.username).push(errorMessage);
            }
        } catch (error) {
            // Hide typing indicator
            hideTypingIndicator();
            
            console.error('Error getting agent greeting:', error);
            const errorMessage = { text: `Error: ${error.message}`, is_image: false, isUser: false };
            addMessage(errorMessage, false);
            chatHistories.get(agent.username).push(errorMessage);
        }
    }
    
    // Function to send message
    async function sendMessage() {
        if (!currentAgent) {
            alert('Please select an agent first');
            return;
        }
        
        const message = userInput.value.trim();
        if (message) {
            // Disable input and button while waiting for response
            userInput.disabled = true;
            sendButton.disabled = true;
            
            // Add user message to chat
            const userMessage = { text: message, is_image: false, isUser: true };
            addMessage(userMessage, true);
            chatHistories.get(currentAgent.username).push(userMessage);
            
            // Clear input
            userInput.value = '';
            
            // Show typing indicator
            showTypingIndicator();
            
            try {
                // Determine endpoint based on message content
                let endpoint = '/generate-text';
                
                // Send message to backend
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        prompt: message,
                        agent_username: currentAgent.username
                    })
                });
                
                // Hide typing indicator
                hideTypingIndicator();
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        // Add agent response to chat
                        const agentMessage = { ...data.data, isUser: false };
                        addMessage(agentMessage, false);
                        chatHistories.get(currentAgent.username).push(agentMessage);
                    } else if (data.status === 'processing' && data.data && data.data.task_id) {
                        // Handle image generation in progress
                        const taskId = data.data.task_id;
                        const agentMessage = { 
                            text: data.data.text || "Image generation in progress...", 
                            is_image: false, 
                            isUser: false,
                            task_id: taskId
                        };
                        addMessage(agentMessage, false);
                        chatHistories.get(currentAgent.username).push(agentMessage);
                        
                        // Start polling for status
                        pollImageStatus(taskId);
                    } else {
                        // Handle error
                        const errorMessage = { text: `Error: ${data.error}`, is_image: false, isUser: false };
                        addMessage(errorMessage, false);
                        chatHistories.get(currentAgent.username).push(errorMessage);
                    }
                } else {
                    // Handle HTTP error
                    const errorMessage = { text: 'Error: Failed to get response from server', is_image: false, isUser: false };
                    addMessage(errorMessage, false);
                    chatHistories.get(currentAgent.username).push(errorMessage);
                }
            } catch (error) {
                // Hide typing indicator
                hideTypingIndicator();
                
                // Handle network error
                const errorMessage = { text: `Error: ${error.message}`, is_image: false, isUser: false };
                addMessage(errorMessage, false);
                chatHistories.get(currentAgent.username).push(errorMessage);
            }
            
            // Re-enable input and button
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.focus();
        }
    }
    
    // Function to poll for image generation status
    async function pollImageStatus(taskId) {
        const maxAttempts = 60; // 5 minutes with 5-second intervals
        let attempts = 0;
        
        const pollInterval = setInterval(async () => {
            attempts++;
            
            try {
                const response = await fetch(`/check-status/${taskId}`);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.status === 'completed') {
                        // Image generation completed
                        clearInterval(pollInterval);
                        
                        // Update the message with the image
                        const messageDiv = document.querySelector(`.message[data-task-id="${taskId}"]`);
                        if (messageDiv) {
                            // Create a container for the image response
                            const imageContainer = document.createElement('div');
                            imageContainer.className = 'image-response';
                            
                            // Add the text message
                            const textDiv = document.createElement('div');
                            textDiv.className = 'message-text';
                            textDiv.textContent = "Here's the image you requested:";
                            imageContainer.appendChild(textDiv);
                            
                            // Add the image
                            const img = document.createElement('img');
                            img.src = data.image_url;
                            img.alt = 'Generated image';
                            img.className = 'generated-image';
                            imageContainer.appendChild(img);
                            
                            // Replace the message content
                            messageDiv.innerHTML = '';
                            messageDiv.appendChild(imageContainer);
                            
                            // Update the chat history
                            const history = chatHistories.get(currentAgent.username);
                            const messageIndex = history.findIndex(msg => msg.task_id === taskId);
                            if (messageIndex !== -1) {
                                history[messageIndex] = {
                                    text: "Here's the image you requested:",
                                    image_url: data.image_url,
                                    is_image: true,
                                    isUser: false
                                };
                            }
                        }
                    } else if (data.status === 'failed') {
                        // Image generation failed
                        clearInterval(pollInterval);
                        
                        // Update the message with the error
                        const messageDiv = document.querySelector(`.message[data-task-id="${taskId}"]`);
                        if (messageDiv) {
                            messageDiv.textContent = `Error: ${data.error}`;
                            
                            // Update the chat history
                            const history = chatHistories.get(currentAgent.username);
                            const messageIndex = history.findIndex(msg => msg.task_id === taskId);
                            if (messageIndex !== -1) {
                                history[messageIndex] = {
                                    text: `Error: ${data.error}`,
                                    is_image: false,
                                    isUser: false
                                };
                            }
                        }
                    } else {
                        // Still processing
                        const messageDiv = document.querySelector(`.message[data-task-id="${taskId}"]`);
                        if (messageDiv) {
                            messageDiv.textContent = `Image generation in progress... (${attempts}/${maxAttempts})`;
                        }
                    }
                }
                
                // Check if we've reached the maximum number of attempts
                if (attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                    
                    // Update the message with a timeout error
                    const messageDiv = document.querySelector(`.message[data-task-id="${taskId}"]`);
                    if (messageDiv) {
                        messageDiv.textContent = "Error: Image generation timed out. Please try again.";
                        
                        // Update the chat history
                        const history = chatHistories.get(currentAgent.username);
                        const messageIndex = history.findIndex(msg => msg.task_id === taskId);
                        if (messageIndex !== -1) {
                            history[messageIndex] = {
                                text: "Error: Image generation timed out. Please try again.",
                                is_image: false,
                                isUser: false
                            };
                        }
                    }
                }
            } catch (error) {
                console.error('Error polling for image status:', error);
            }
        }, 5000); // Poll every 5 seconds
    }
    
    // Function to add message to chat
    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        
        // Add task_id as data attribute if it exists
        if (message.task_id) {
            messageDiv.setAttribute('data-task-id', message.task_id);
        }
        
        if (isUser) {
            // User message is just text
            messageDiv.textContent = message.text;
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