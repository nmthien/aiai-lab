# Multi-Agents Playground

A Flask application that provides a chat interface for interacting with various AI agents.

## Features

- Chat interface with multiple AI agents
- Image generation using Midjourney
- Text generation using OpenAI
- MongoDB integration for agent profiles

## Deployment on Render

1. Fork this repository
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Configure the following environment variables:
   - `MONGO_URI`: Your MongoDB connection string
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `GOAPI_API_KEY`: Your GoAPI key for Midjourney

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file with your environment variables
4. Run the application:
   ```bash
   python agent_server.py
   ```

## Environment Variables

Create a `.env` file with the following variables:
```
MONGO_URI=your_mongodb_uri
OPENAI_API_KEY=your_openai_key
GOAPI_API_KEY=your_goapi_key
```

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