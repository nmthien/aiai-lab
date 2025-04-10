import os
import requests
import time
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from openai import OpenAI
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from image_keywords import IMAGE_GENERATION_KEYWORDS
from agent_usernames import AGENT_USERNAMES

app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for all routes

# Load environment variables
load_dotenv()

# MongoDB connection with retry logic
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    raise ValueError("MONGO_URI environment variable is not set")

def connect_to_mongodb(max_retries=3, retry_delay=2):
    for attempt in range(max_retries):
        try:
            # Use the newer connection string format
            client = MongoClient(
                MONGO_URI,
                serverSelectionTimeoutMS=10000,  # Increased timeout
                connectTimeoutMS=10000,
                retryWrites=True,
                retryReads=True
            )
            # Test the connection
            client.server_info()
            print(f"Successfully connected to MongoDB on attempt {attempt + 1}")
            return client
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            print(f"Attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_retries - 1:
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print("All connection attempts failed")
                raise

try:
    client = connect_to_mongodb()
    db = client.aiai
    agents_collection = db.agents
except Exception as e:
    print(f"Failed to establish MongoDB connection: {str(e)}")
    raise

# Security headers
@app.after_request
def add_security_headers(response):
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.openai.com https://api.goapi.ai;"
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

class MidjourneyAgent:
    def __init__(self):
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
            print(f"Sending request to Midjourney API: {payload}")  # Debug print
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
                
        except Exception as e:
            print(f"Exception occurred: {str(e)}")
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
         
    def wait_for_task_completion(self, task_id: str, max_attempts: int = 12, delay: int = 5) -> dict:
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
             try:
                 result = self.check_task_status(task_id)
                 if result and result.get('code') == 200:
                     status = result['data']['status']
                     if status == 'completed':
                         return result
                     elif status == 'failed':
                         print(f"Task failed: {result['data']['error']['message']}")
                         return None
                     elif status == 'processing':
                         print(f"Task still processing (attempt {attempt+1}/{max_attempts})")
                 else:
                     print(f"Unexpected response format: {result}")
             except Exception as e:
                 print(f"Error checking task status: {str(e)}")
             
             # Sleep between attempts
             time.sleep(delay)
         
         print("Task timed out after maximum attempts")
         return None

    def generate_text(self, prompt: str, model: str = "gpt-4o", agent_username: str = None) -> dict:
        """
        Generate text response using OpenAI API or image using Midjourney if requested
        
        Args:
            prompt (str): The prompt for text generation or image description
            model (str): The OpenAI model to use (default: gpt-4o)
            agent_username (str): The username of the agent to use for the conversation
            
        Returns:
            dict: Response containing the generated text/image and status
        """
        # Check if the prompt is requesting an image generation
        prompt_lower = prompt.lower()
        is_image_request = any(keyword in prompt_lower for keyword in IMAGE_GENERATION_KEYWORDS)
        
        if is_image_request:
            # Extract the image description from the prompt
            # This is a simple approach - in a real app, you might use NLP to extract the description
            image_prompt = prompt
            
            # Generate image using Midjourney
            result = self.generate_image(image_prompt)
            if result and result.get('code') == 200:
                task_id = result['data']['task_id']
                # Return immediately with the task ID instead of waiting for completion
                return {
                    "status": "processing",
                    "data": {
                        "text": "Image generation started. Please check the status endpoint for progress.",
                        "task_id": task_id,
                        "is_image": True
                    }
                }
            else:
                print(f"Failed to create image generation task: {result}")  # Debug print
                return {
                    "status": "error",
                    "error": "Failed to create image generation task"
                }
        
        # If not an image request, proceed with text generation
        try:
            # If agent_username is provided, fetch the agent profile from MongoDB
            system_prompt = "You are a helpful AI assistant."
            if agent_username:
                agent = agents_collection.find_one({"username": agent_username})
                if agent:
                    # Construct system prompt from agent profile
                    system_prompt = f"""You are {agent.get('identity', 'an AI assistant')}.
Your knowledge includes: {agent.get('knowledge', 'general information')}.
You specialize in: {agent.get('topic', 'general assistance')}.
Your voice tone is: {agent.get('voice_tone', 'professional and friendly')}.
Please respond to the user in this voice tone and from this perspective."""
            
            # Create messages array with system and user messages
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
            
            # Call OpenAI API with the constructed messages
            response = self.openai_client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=1000,
                temperature=0.7
            )
            
            # Extract the text from the response
            if response.choices and len(response.choices) > 0:
                text = response.choices[0].message.content
                return {
                    "status": "success",
                    "data": {
                        "text": text,
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

@app.route('/agents', methods=['GET'])
def get_agents():
    """Get list of available agents from MongoDB"""
    try:
        print("Fetching agents from MongoDB...")
        # Query for specific usernames with timeout and retry
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                agents = list(agents_collection.find(
                    {"username": {"$in": AGENT_USERNAMES}},
                    {"_id": 0, "username": 1, "name": 1}
                ).max_time_ms(10000))  # Increased timeout
                
                print(f"Found {len(agents)} agents")
                return jsonify({"status": "success", "data": agents})
            except ServerSelectionTimeoutError as e:
                print(f"Attempt {attempt + 1} failed: {str(e)}")
                if attempt < max_retries - 1:
                    print(f"Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                else:
                    print("All attempts failed")
                    return jsonify({
                        "status": "error",
                        "error": "Database connection timeout. Please try again later."
                    }), 503
    except Exception as e:
        print(f"Error fetching agents: {str(e)}")
        return jsonify({
            "status": "error",
            "error": "An unexpected error occurred. Please try again later."
        }), 500

@app.route('/generate', methods=['POST'])
def generate_image():
    data = request.get_json()
    prompt = data.get('prompt')
    
    if not prompt:
        return jsonify({'error': 'Prompt is required'}), 400
    
    result = agent.generate_image(prompt)
    if result and result.get('code') == 200:
        task_id = result['data']['task_id']
        # Return immediately with the task ID instead of waiting for completion
        return jsonify({
            'status': 'processing',
            'task_id': task_id,
            'message': 'Image generation started. Use /check-status/{task_id} to check progress.'
        })
    else:
        return jsonify({'error': 'Failed to create image generation task'}), 500

@app.route('/check-status/<task_id>', methods=['GET'])
def check_status(task_id):
    """Check the status of an image generation task"""
    if not task_id:
        return jsonify({'error': 'Task ID is required'}), 400
    
    result = agent.check_task_status(task_id)
    if not result:
        return jsonify({'error': 'Failed to check task status'}), 500
    
    if result.get('code') == 200:
        status = result['data']['status']
        if status == 'completed':
            image_url = result['data']['output']['image_url']
            return jsonify({
                'status': 'completed',
                'image_url': image_url
            })
        elif status == 'failed':
            error_message = result['data']['error']['message']
            return jsonify({
                'status': 'failed',
                'error': error_message
            })
        else:
            return jsonify({
                'status': 'processing',
                'message': f'Task is still {status}'
            })
    else:
        return jsonify({'error': 'Unexpected response format'}), 500

@app.route('/generate-text', methods=['POST'])
def generate_text():
    data = request.get_json()
    prompt = data.get('prompt')
    model = data.get('model', 'gpt-4o')
    agent_username = data.get('agent_username')
    
    if not prompt:
        return jsonify({'error': 'Prompt is required'}), 400
    
    result = agent.generate_text(prompt, model, agent_username)
    return jsonify(result)

@app.route('/run-workflow', methods=['POST'])
def run_workflow():
    """
    Run a workflow that combines text generation and image generation
    """
    data = request.get_json()
    prompt = data.get('prompt')
    agent_username = data.get('agent_username')
    
    if not prompt:
        return jsonify({'error': 'Prompt is required'}), 400
    
    # First, generate text response
    text_result = agent.generate_text(prompt, agent_username=agent_username)
    
    # If there was an error, return it
    if text_result.get('status') == 'error':
        return jsonify(text_result), 500
    
    # If the text response indicates an image should be generated
    if text_result.get('data', {}).get('is_image'):
        # If it's a processing status (for image generation), return that
        if text_result.get('status') == 'processing':
            return jsonify(text_result)
        # Otherwise, return the text response
        return jsonify(text_result)
    
    # Otherwise, return the text response
    return jsonify(text_result)

if __name__ == '__main__':
    app.run(debug=True) 