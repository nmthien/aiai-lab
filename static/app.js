document.addEventListener('DOMContentLoaded', function() {
    // Initialize jsPlumb
    const jsPlumbInstance = jsPlumb.getInstance({
        Connector: ['Flowchart', { cornerRadius: 5 }],
        Anchors: ['Right', 'Left'],
        Endpoint: ['Dot', { radius: 5 }],
        EndpointStyle: { fill: '#3498db' },
        PaintStyle: { stroke: '#3498db', strokeWidth: 2 },
        HoverPaintStyle: { stroke: '#2980b9', strokeWidth: 3 },
        ConnectionOverlays: [
            ['Arrow', { location: 1, width: 12, length: 12 }],
            ['Label', { location: 0.5, cssClass: 'connection-label' }]
        ],
        Container: 'canvas'
    });

    // Set up jsPlumb defaults
    jsPlumbInstance.setContainer('canvas');
    jsPlumbInstance.importDefaults({
        DragOptions: { cursor: 'pointer', zIndex: 2000 },
        Anchors: ['Right', 'Left'],
        Endpoint: ['Dot', { radius: 5 }],
        PaintStyle: { stroke: '#3498db', strokeWidth: 2 },
        HoverPaintStyle: { stroke: '#2980b9', strokeWidth: 3 },
        ConnectionOverlays: [
            ['Arrow', { location: 1, width: 12, length: 12 }],
            ['Label', { location: 0.5, cssClass: 'connection-label' }]
        ]
    });

    // Variables to track state
    let nodeCounter = 0;
    let selectedNode = null;
    let isConnecting = false;
    let sourceNode = null;

    // DOM Elements
    const canvas = document.getElementById('canvas');
    const agentBlocks = document.querySelectorAll('.agent-block');
    const addConnectionBtn = document.getElementById('add-connection');
    const deleteSelectedBtn = document.getElementById('delete-selected');
    const clearCanvasBtn = document.getElementById('clear-canvas');
    const saveWorkflowBtn = document.getElementById('save-workflow');
    const loadWorkflowBtn = document.getElementById('load-workflow');
    const runWorkflowBtn = document.getElementById('run-workflow');
    const propertiesContent = document.getElementById('properties-content');

    // Make agent blocks draggable
    agentBlocks.forEach(block => {
        block.addEventListener('dragstart', handleDragStart);
    });

    // Canvas event listeners
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);
    canvas.addEventListener('click', handleCanvasClick);

    // Button event listeners
    addConnectionBtn.addEventListener('click', toggleConnectionMode);
    deleteSelectedBtn.addEventListener('click', deleteSelectedNode);
    clearCanvasBtn.addEventListener('click', clearCanvas);
    saveWorkflowBtn.addEventListener('click', saveWorkflow);
    loadWorkflowBtn.addEventListener('click', loadWorkflow);
    runWorkflowBtn.addEventListener('click', runWorkflow);

    // Drag and drop handlers
    function handleDragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.getAttribute('data-type'));
    }

    function handleDragOver(e) {
        e.preventDefault();
    }

    function handleDrop(e) {
        e.preventDefault();
        const agentType = e.dataTransfer.getData('text/plain');
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        createNode(agentType, x, y);
    }

    // Node creation
    function createNode(type, x, y) {
        nodeCounter++;
        const nodeId = `node-${nodeCounter}`;
        
        const node = document.createElement('div');
        node.id = nodeId;
        node.className = `node ${type}`;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        
        const header = document.createElement('div');
        header.className = 'node-header';
        header.innerHTML = `
            <span>${type.charAt(0).toUpperCase() + type.slice(1)} Agent</span>
            <span>${nodeId}</span>
        `;
        
        const content = document.createElement('div');
        content.className = 'node-content';
        content.textContent = getDefaultContent(type);
        
        const actions = document.createElement('div');
        actions.className = 'node-actions';
        actions.innerHTML = `
            <button class="edit-node">Edit</button>
            <button class="delete-node">Delete</button>
        `;
        
        node.appendChild(header);
        node.appendChild(content);
        node.appendChild(actions);
        
        canvas.appendChild(node);
        
        // Make the node draggable with jsPlumb
        jsPlumbInstance.draggable(node, {
            grid: [10, 10]
        });
        
        // Add endpoints
        jsPlumbInstance.addEndpoint(nodeId, {
            isSource: true,
            anchor: 'Right',
            maxConnections: -1,
            endpoint: 'Dot',
            paintStyle: { fill: '#3498db' },
            hoverPaintStyle: { fill: '#2980b9' }
        });
        
        jsPlumbInstance.addEndpoint(nodeId, {
            isTarget: true,
            anchor: 'Left',
            maxConnections: -1,
            endpoint: 'Dot',
            paintStyle: { fill: '#3498db' },
            hoverPaintStyle: { fill: '#2980b9' }
        });
        
        // Node event listeners
        node.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-node') || 
                e.target.classList.contains('delete-node')) {
                return;
            }
            
            selectNode(node);
        });
        
        node.querySelector('.edit-node').addEventListener('click', () => {
            editNode(node);
        });
        
        node.querySelector('.delete-node').addEventListener('click', () => {
            deleteNode(node);
        });
        
        return node;
    }

    // Node selection
    function selectNode(node) {
        if (selectedNode) {
            selectedNode.classList.remove('selected');
        }
        
        selectedNode = node;
        node.classList.add('selected');
        
        updatePropertiesPanel(node);
    }

    // Properties panel
    function updatePropertiesPanel(node) {
        const type = node.classList[1];
        const nodeId = node.id;
        
        let propertiesHTML = `
            <h3>${type.charAt(0).toUpperCase() + type.slice(1)} Agent Properties</h3>
            <p><strong>ID:</strong> ${nodeId}</p>
        `;
        
        if (type === 'midjourney') {
            propertiesHTML += `
                <div class="property">
                    <label for="prompt">Prompt:</label>
                    <textarea id="prompt" rows="3">${node.querySelector('.node-content').textContent}</textarea>
                </div>
                <div class="property">
                    <label for="aspect-ratio">Aspect Ratio:</label>
                    <select id="aspect-ratio">
                        <option value="1:1">1:1</option>
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                    </select>
                </div>
                <div class="property">
                    <label for="process-mode">Process Mode:</label>
                    <select id="process-mode">
                        <option value="fast">Fast</option>
                        <option value="relax">Relax</option>
                    </select>
                </div>
                <button id="save-properties">Save Properties</button>
            `;
        } else if (type === 'gpt') {
            propertiesHTML += `
                <div class="property">
                    <label for="prompt">Prompt:</label>
                    <textarea id="prompt" rows="3">${node.querySelector('.node-content').textContent}</textarea>
                </div>
                <div class="property">
                    <label for="model">Model:</label>
                    <select id="model">
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </select>
                </div>
                <button id="save-properties">Save Properties</button>
            `;
        } else {
            propertiesHTML += `
                <div class="property">
                    <label for="custom-config">Configuration:</label>
                    <textarea id="custom-config" rows="5">${node.querySelector('.node-content').textContent}</textarea>
                </div>
                <button id="save-properties">Save Properties</button>
            `;
        }
        
        propertiesContent.innerHTML = propertiesHTML;
        
        // Add event listener to save button
        document.getElementById('save-properties').addEventListener('click', () => {
            saveNodeProperties(node);
        });
    }

    // Save node properties
    function saveNodeProperties(node) {
        const type = node.classList[1];
        const contentElement = node.querySelector('.node-content');
        
        if (type === 'midjourney') {
            contentElement.textContent = document.getElementById('prompt').value;
        } else if (type === 'gpt') {
            contentElement.textContent = document.getElementById('prompt').value;
        } else {
            contentElement.textContent = document.getElementById('custom-config').value;
        }
    }

    // Edit node
    function editNode(node) {
        selectNode(node);
        // Focus on the first input in the properties panel
        const firstInput = propertiesContent.querySelector('input, textarea, select');
        if (firstInput) {
            firstInput.focus();
        }
    }

    // Delete node
    function deleteNode(node) {
        jsPlumbInstance.remove(node);
        
        if (selectedNode === node) {
            selectedNode = null;
            propertiesContent.innerHTML = '<p>Select an agent to view its properties</p>';
        }
    }

    // Delete selected node
    function deleteSelectedNode() {
        if (selectedNode) {
            deleteNode(selectedNode);
        }
    }

    // Clear canvas
    function clearCanvas() {
        if (confirm('Are you sure you want to clear the canvas? This will delete all nodes and connections.')) {
            jsPlumbInstance.reset();
            canvas.innerHTML = '';
            selectedNode = null;
            propertiesContent.innerHTML = '<p>Select an agent to view its properties</p>';
        }
    }

    // Connection mode
    function toggleConnectionMode() {
        isConnecting = !isConnecting;
        addConnectionBtn.classList.toggle('active');
        
        if (isConnecting) {
            canvas.style.cursor = 'crosshair';
            alert('Click on a node to start a connection, then click on another node to complete the connection.');
        } else {
            canvas.style.cursor = 'default';
            sourceNode = null;
        }
    }

    // Canvas click handler
    function handleCanvasClick(e) {
        if (!isConnecting) return;
        
        const node = e.target.closest('.node');
        if (!node) return;
        
        if (!sourceNode) {
            sourceNode = node;
            node.classList.add('connecting');
        } else {
            if (sourceNode !== node) {
                // Create connection
                jsPlumbInstance.connect({
                    source: sourceNode.id,
                    target: node.id,
                    overlays: [
                        ['Arrow', { location: 1, width: 12, length: 12 }],
                        ['Label', { location: 0.5, cssClass: 'connection-label' }]
                    ]
                });
            }
            
            sourceNode.classList.remove('connecting');
            sourceNode = null;
            isConnecting = false;
            addConnectionBtn.classList.remove('active');
            canvas.style.cursor = 'default';
        }
    }

    // Get default content based on agent type
    function getDefaultContent(type) {
        switch (type) {
            case 'midjourney':
                return 'A beautiful landscape with mountains and a lake at sunset';
            case 'gpt':
                return 'Generate a creative story about a robot learning to paint';
            case 'custom':
                return '{"type": "custom", "config": {}}';
            default:
                return '';
        }
    }

    // Save workflow
    function saveWorkflow() {
        const nodes = [];
        const connections = [];
        
        // Get all nodes
        document.querySelectorAll('.node').forEach(node => {
            const type = node.classList[1];
            const id = node.id;
            const position = {
                x: parseInt(node.style.left),
                y: parseInt(node.style.top)
            };
            const content = node.querySelector('.node-content').textContent;
            
            nodes.push({
                id,
                type,
                position,
                content
            });
        });
        
        // Get all connections
        jsPlumbInstance.getAllConnections().forEach(conn => {
            connections.push({
                source: conn.source.id,
                target: conn.target.id
            });
        });
        
        const workflow = {
            nodes,
            connections
        };
        
        const workflowJson = JSON.stringify(workflow);
        
        // Save to localStorage
        localStorage.setItem('savedWorkflow', workflowJson);
        
        // Also offer download
        const blob = new Blob([workflowJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'workflow.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Workflow saved successfully!');
    }

    // Load workflow
    function loadWorkflow() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = function(e) {
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = function(event) {
                try {
                    const workflow = JSON.parse(event.target.result);
                    loadWorkflowFromData(workflow);
                } catch (error) {
                    alert('Error loading workflow: ' + error.message);
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }

    // Load workflow from data
    function loadWorkflowFromData(workflow) {
        // Clear canvas first
        clearCanvas();
        
        // Create nodes
        workflow.nodes.forEach(nodeData => {
            const node = createNode(
                nodeData.type,
                nodeData.position.x,
                nodeData.position.y
            );
            
            node.querySelector('.node-content').textContent = nodeData.content;
        });
        
        // Create connections
        workflow.connections.forEach(conn => {
            jsPlumbInstance.connect({
                source: conn.source,
                target: conn.target,
                overlays: [
                    ['Arrow', { location: 1, width: 12, length: 12 }],
                    ['Label', { location: 0.5, cssClass: 'connection-label' }]
                ]
            });
        });
        
        alert('Workflow loaded successfully!');
    }

    // Run workflow
    function runWorkflow() {
        // Get all nodes and connections
        const nodes = [];
        const connections = [];
        
        // Collect all nodes
        document.querySelectorAll('.node').forEach(node => {
            const nodeId = node.id;
            const nodeType = node.classList[1];
            const nodeContent = node.querySelector('.node-content').textContent;
            
            nodes.push({
                id: nodeId,
                type: nodeType,
                content: nodeContent
            });
        });
        
        // Collect all connections
        jsPlumbInstance.getAllConnections().forEach(conn => {
            connections.push({
                source: conn.source.id,
                target: conn.target.id
            });
        });
        
        // Create workflow data
        const workflowData = {
            nodes: nodes,
            connections: connections
        };
        
        // Show loading message
        const outputContent = document.getElementById('output-content');
        outputContent.innerHTML = '<p>Running workflow...</p>';
        
        // Send workflow data to backend
        fetch('/run-workflow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(workflowData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Display the output
            displayOutput(data);
        })
        .catch(error => {
            console.error('Error running workflow:', error);
            outputContent.innerHTML = `<p>Error running workflow: ${error.message}</p>`;
        });
    }
    
    // Function to display output from the workflow
    function displayOutput(data) {
        const outputContent = document.getElementById('output-content');
        
        // Clear previous output
        outputContent.innerHTML = '';
        
        // Check if there's an error
        if (data.error) {
            outputContent.innerHTML = `<p>Error: ${data.error}</p>`;
            return;
        }
        
        // Display the output based on its type
        if (data.type === 'text') {
            outputContent.innerHTML = `<p>${data.content}</p>`;
        } else if (data.type === 'image') {
            outputContent.innerHTML = `
                <p>Generated Image:</p>
                <img src="${data.content}" alt="Generated image">
            `;
        } else if (data.type === 'video') {
            outputContent.innerHTML = `
                <p>Generated Video:</p>
                <video controls>
                    <source src="${data.content}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
        } else {
            outputContent.innerHTML = `<p>Unknown output type: ${data.type}</p>`;
        }
    }
}); 