import os
import requests
import time
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI

app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for all routes

class MidjourneyAgent:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv('GOAPI_API_KEY')
        self.openai_key = os.getenv('OPENAI_API_KEY')
        self.base_url = "https://api.goapi.ai/api/v1/task"
        
        if not self.api_key:
            raise ValueError("GOAPI_API_KEY environment variable is not set")
        
        if not self.openai_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        
        # Initialize OpenAI client
        self.openai_client = OpenAI(api_key=self.openai_key)

    def generate_image(self, prompt: str) -> dict:
        """
        Generate an image using Midjourney API
        
        Args:
            prompt (str): The prompt describing the image to generate
            
        Returns:
            dict: Response from the API containing task ID and status
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "type": "imagine",
            "config": {
                "service_mode": "private"
            },
            "input": {
                "prompt": prompt
            }
        }
        
        try:
            print(f"Sending request to Midjourney API: {payload}")  # Debug print   
            response = requests.post(
                self.base_url,
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"API Response: {result}")  # Debug print
                return result
            else:
                print(f"Error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"Exception occurred: {str(e)}")
            return None

    def wait_for_task_completion(self, task_id: str, timeout: int = 300) -> dict:
        """
        Wait for a task to complete and return the result
        
        Args:
            task_id (str): The ID of the task to check
            timeout (int): Maximum time to wait in seconds
            
        Returns:
            dict: The final result of the task
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                response = requests.get(
                    f"{self.base_url}/{task_id}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result and result.get('code') == 200:
                        status = result['data']['status']
                        if status == 'completed':
                            print(f"Task completed successfully: {result}")  # Debug print
                            return result
                        elif status == 'failed':
                            print(f"Task failed: {result['data']['error']['message']}")
                            return None
                
                time.sleep(5)  # Wait 5 seconds before checking again
                
            except Exception as e:
                print(f"Error checking task status: {str(e)}")
                return None
        
        print("Task timed out")
        return None

    def generate_text(self, prompt: str, model: str = "gpt-4o") -> dict:
        """
        Generate text response using OpenAI API or image using Midjourney if requested
        
        Args:
            prompt (str): The prompt for text generation or image description
            model (str): The OpenAI model to use (default: gpt-4o)
            
        Returns:
            dict: Response containing the generated text/image and status
        """
        # Check if the prompt is requesting an image generation
        if "generate an image" in prompt.lower() or "create an image" in prompt.lower() or "draw" in prompt.lower():
            # Extract the image description from the prompt
            # This is a simple approach - in a real app, you might use NLP to extract the description
            image_prompt = prompt
            
            # Generate image using Midjourney
            result = self.generate_image(image_prompt)
            if result and result.get('code') == 200:
                task_id = result['data']['task_id']
                
                # Wait for the image generation to complete
                final_result = self.wait_for_task_completion(task_id)
                if final_result and final_result.get('data', {}).get('output', {}).get('image_url'):
                    image_url = final_result['data']['output']['image_url']
                    print(f"Generated image URL: {image_url}")  # Debug print
                    return {
                        "status": "success",
                        "data": {
                            "text": f"Here's the image you requested:",
                            "image_url": image_url,
                            "is_image": True
                        }
                    }
                else:
                    print(f"Failed to get image URL from result: {final_result}")  # Debug print
                    return {
                        "status": "error",
                        "error": "Failed to generate image"
                    }
            else:
                print(f"Failed to create image generation task: {result}")  # Debug print
                return {
                    "status": "error",
                    "error": "Failed to create image generation task"
                }
        
        # If not an image request, proceed with text generation
        try:
            response = self.openai_client.responses.create(
                model=model,
                input=prompt
            )
            
            # Extract the text from the nested response structure
            if response.status == "completed" and response.output:
                # The output is a list of messages, we take the first one
                message = response.output[0]
                if message.content:
                    # The content is a list of content items, we take the first one
                    content_item = message.content[0]
                    if content_item.type == "output_text":
                        return {
                            "status": "success",
                            "data": {
                                "text": content_item.text,
                                "is_image": False
                            }
                        }
            
            # If we couldn't extract the text properly
            return {
                "status": "error",
                "error": "Failed to extract text from response"
            }
        except Exception as e:
            print(f"Error generating text with OpenAI: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }

agent = MidjourneyAgent()

@app.route('/')
def index():
    """Serve the main application page"""
    return send_from_directory('static', 'index.html')

@app.route('/chat')
def chat():
    """Serve the chat interface"""
    return send_from_directory('static', 'chat.html')

@app.route('/generate', methods=['POST'])
def generate_image():
    data = request.get_json()
    prompt = data.get('prompt')
    
    if not prompt:
        return jsonify({'error': 'Prompt is required'}), 400
    
    result = agent.generate_image(prompt)
    if result and result.get('code') == 200:
        task_id = result['data']['task_id']
        return jsonify({'task_id': task_id})
    else:
        return jsonify({'error': 'Failed to create image generation task'}), 500

@app.route('/generate-text', methods=['POST'])
def generate_text():
    data = request.get_json()
    prompt = data.get('prompt')
    model = data.get('model', 'gpt-4o')
    
    if not prompt:
        return jsonify({'error': 'Prompt is required'}), 400
    
    result = agent.generate_text(prompt, model)
    return jsonify(result)

@app.route('/run-workflow', methods=['POST'])
def run_workflow():
    """
    Run a workflow that combines text generation and image generation
    """
    data = request.get_json()
    prompt = data.get('prompt')
    
    if not prompt:
        return jsonify({'error': 'Prompt is required'}), 400
    
    # First, generate text response
    text_result = agent.generate_text(prompt)
    if text_result.get('status') == 'error':
        return jsonify(text_result), 500
    
    # If the text response indicates an image should be generated
    if text_result.get('data', {}).get('is_image'):
        return jsonify(text_result)
    
    # Otherwise, return the text response
    return jsonify(text_result)

if __name__ == '__main__':
    app.run(debug=True) 