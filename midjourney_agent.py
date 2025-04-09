import os
import requests
import time
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for all routes

class MidjourneyAgent:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv('GOAPI_API_KEY')
        self.base_url = "https://api.goapi.ai/api/v1/task"
        
        if not self.api_key:
            raise ValueError("GOAPI_API_KEY environment variable is not set")

    def generate_image(self, prompt: str) -> dict:
        """
        Generate an image using Midjourney through goapi.ai
        
        Args:
            prompt (str): The prompt describing the image to generate
            
        Returns:
            dict: Response containing the generated image URL and status
        """
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "midjourney",
            "task_type": "imagine",
            "input": {
                "prompt": prompt,
                "aspect_ratio": "1:1",
                "process_mode": "fast",
                "skip_prompt_check": False
            },
            "config": {
                "service_mode": "private",
                "webhook_config": {
                    "endpoint": "",
                    "secret": ""
                }
            }
        }
        
        try:
            response = requests.post(
                self.base_url,
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error generating image: {str(e)}")
            return None

    def check_task_status(self, task_id: str) -> dict:
        """
        Check the status of a task and retrieve the result if completed.
        
        Args:
            task_id (str): The ID of the task to check
            
        Returns:
            dict: Response containing the task status and result if completed
        """
        headers = {
            "x-api-key": self.api_key
        }
        
        try:
            response = requests.get(
                f"{self.base_url}/{task_id}",
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error checking task status: {str(e)}")
            return None

    def wait_for_task_completion(self, task_id: str, max_attempts: int = 30, delay: int = 10) -> dict:
        """
        Wait for a task to complete and retrieve the final result.
        
        Args:
            task_id (str): The ID of the task to wait for
            max_attempts (int): Maximum number of attempts to check the task status
            delay (int): Delay between attempts in seconds
            
        Returns:
            dict: Response containing the task result if completed, None otherwise
        """
        for attempt in range(max_attempts):
            result = self.check_task_status(task_id)
            if result and result.get('code') == 200:
                status = result['data']['status']
                if status == 'completed':
                    return result
                elif status == 'failed':
                    print(f"Task failed: {result['data']['error']['message']}")
                    return None
            time.sleep(delay)
        print("Task timed out")
        return None

agent = MidjourneyAgent()

@app.route('/')
def index():
    """Serve the main application page"""
    return send_from_directory('static', 'index.html')

@app.route('/generate', methods=['POST'])
def generate_image():
    data = request.get_json()
    prompt = data.get('prompt')
    
    if not prompt:
        return jsonify({'error': 'Prompt is required'}), 400
    
    result = agent.generate_image(prompt)
    if result and result.get('code') == 200:
        task_id = result['data']['task_id']
        
        final_result = agent.wait_for_task_completion(task_id)
        if final_result:
            return jsonify({
                'status': 'success',
                'image_url': final_result['data']['output']['image_url']
            })
        else:
            return jsonify({'error': 'Failed to generate image'}), 500
    else:
        return jsonify({'error': 'Failed to create image generation task'}), 500

@app.route('/run-workflow', methods=['POST'])
def run_workflow():
    """
    Execute a workflow defined by nodes and connections.
    
    The workflow data should contain:
    - nodes: List of nodes with id, type, and content
    - connections: List of connections with source and target node ids
    
    Returns:
        JSON response with the workflow execution result
    """
    data = request.get_json()
    
    if not data or 'nodes' not in data or 'connections' not in data:
        return jsonify({'error': 'Invalid workflow data'}), 400
    
    nodes = data['nodes']
    connections = data['connections']
    
    # Find the starting node (node with no incoming connections)
    start_nodes = []
    for node in nodes:
        is_start = True
        for conn in connections:
            if conn['target'] == node['id']:
                is_start = False
                break
        if is_start:
            start_nodes.append(node)
    
    if not start_nodes:
        return jsonify({'error': 'No starting node found in the workflow'}), 400
    
    # For now, we'll just execute the first starting node
    # In a more complex implementation, you would execute the entire workflow
    start_node = start_nodes[0]
    
    # Execute the node based on its type
    if start_node['type'] == 'midjourney':
        # Generate image using Midjourney
        result = agent.generate_image(start_node['content'])
        if result and result.get('code') == 200:
            task_id = result['data']['task_id']
            
            final_result = agent.wait_for_task_completion(task_id)
            if final_result:
                return jsonify({
                    'type': 'image',
                    'content': final_result['data']['output']['image_url']
                })
            else:
                return jsonify({'error': 'Failed to generate image'}), 500
        else:
            return jsonify({'error': 'Failed to create image generation task'}), 500
    elif start_node['type'] == 'gpt':
        # For now, just return a mock response for GPT
        return jsonify({
            'type': 'text',
            'content': f"GPT response to: {start_node['content']}"
        })
    else:
        # For custom or unknown agent types
        return jsonify({
            'type': 'text',
            'content': f"Custom agent response to: {start_node['content']}"
        })

if __name__ == '__main__':
    app.run(debug=True) 