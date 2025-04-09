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

#### Running the Application

Start the Flask server:
```
python midjourney_agent.py
```

The application will be available at http://localhost:5000

#### Using the Web Interface

1. Open http://localhost:5000 in your web browser
2. Drag and drop agent blocks onto the canvas
3. Connect agents by clicking the "Add Connection" button and then clicking on source and target agents
4. Configure agent properties by selecting an agent and editing its properties in the properties panel
5. Click the "Run Workflow" button to execute the workflow
6. The output will be displayed in the output panel on the right side of the canvas

#### API Endpoints

- `POST /generate`: Generate an image using Midjourney
  - Request body: `{ "prompt": "Your image prompt" }`
  - Response: `{ "status": "success", "image_url": "https://..." }`

- `POST /run-workflow`: Execute a workflow
  - Request body: `{ "nodes": [...], "connections": [...] }`
  - Response: `{ "type": "image|text|video", "content": "..." }`

## License

[MIT License](LICENSE) 