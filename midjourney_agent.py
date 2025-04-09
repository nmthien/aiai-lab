import os
import requests
import time
from dotenv import load_dotenv
from flask import Flask, request, jsonify

app = Flask(__name__)

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

if __name__ == '__main__':
    app.run(debug=True) 