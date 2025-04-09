# Multi-Agents Playground

A project for experimenting with various AI agents, including a Midjourney image generation agent.

## Midjourney Agent

The Midjourney agent allows you to generate images using the Midjourney API through goapi.ai.

### Setup

1. Clone this repository
2. Create a `.env` file in the root directory with your API key:
   ```
   GOAPI_API_KEY=your_api_key_here
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

### Usage

Run the Flask application:
```
python midjourney_agent.py
```

Send a POST request to `/generate` with a JSON body containing a `prompt` field:
```
{
  "prompt": "A beautiful sunset over mountains"
}
```

The API will return a JSON response with the generated image URL when the task is completed.

## License

[MIT License](LICENSE) 