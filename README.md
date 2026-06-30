# 🤖 Local AI Agent — Full Computer Access

A powerful local AI agent powered by **Ollama** that can fully control your computer.
Built for your RTX 3060 (12GB VRAM) setup.

---

## ⚡ Quick Start

### 1. Install Ollama
```bash
# Windows
winget install Ollama.Ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Pull the recommended model
```bash
# Best for your RTX 3060 12GB (fits perfectly in VRAM)
ollama pull qwen2.5:14b

# Lighter/faster alternative
ollama pull llama3.1:8b
```

### 3. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the agent
```bash
python agent.py

# Use a different model
python agent.py --model llama3.1:8b

# Skip confirmation prompts (⚠️ DANGEROUS — agent acts without asking)
python agent.py --no-confirm
```

---

## 🛠️ What It Can Do

| Tool              | What it does                                         |
|-------------------|------------------------------------------------------|
| `run_shell`       | Execute any terminal command                         |
| `read_file`       | Read any file on disk                                |
| `write_file`      | Create or overwrite files                            |
| `list_directory`  | Browse folder contents                               |
| `delete_file`     | Delete files or directories                          |
| `copy_file`       | Copy files                                           |
| `move_file`       | Move or rename files                                 |
| `get_system_info` | CPU, RAM, disk, running processes                    |
| `open_url`        | Open any URL in your browser                         |
| `search_files`    | Find files by name pattern (glob)                    |
| `get_env`         | Read environment variables                           |
| `take_screenshot` | Screenshot your screen (requires pyautogui)         |

---

## 💬 Example Commands

```
You: List all Python files in my Documents folder
You: Read the file C:/Users/Rehman/project/app.py and summarize it
You: Create a new file called hello.py with a hello world program
You: What's my disk usage?
You: Find all .env files on my computer
You: Open GitHub in my browser
You: Run my React app (npm start) in the project folder
You: Show me my system info including running processes
You: Take a screenshot
```

---

## 🔒 Safety Features

- **Confirmation prompts** before dangerous shell commands (rm -rf, delete, format, etc.)
- **Confirmation prompts** before deleting any file
- **File size limit** — won't read files over 1MB (use shell `head`/`tail` instead)
- **Command timeout** — shell commands timeout after 60 seconds
- **Sensitive env vars** are hidden (PASSWORD, SECRET, TOKEN, KEY, API)

---

## 🎮 CLI Commands

While chatting with the agent:

| Command   | Action                          |
|-----------|---------------------------------|
| `clear`   | Reset conversation history      |
| `history` | Show message history preview    |
| `exit`    | Quit the agent                  |

---

## 🔧 Model Recommendations for RTX 3060 12GB

| Model              | VRAM   | Speed  | Tool Calling |
|--------------------|--------|--------|--------------|
| `qwen2.5:14b`      | ~9GB   | Fast   | ⭐⭐⭐⭐⭐        |
| `llama3.1:8b`      | ~5GB   | Faster | ⭐⭐⭐⭐         |
| `qwen2.5:7b`       | ~5GB   | Fast   | ⭐⭐⭐⭐         |
| `mistral:7b`       | ~5GB   | Fast   | ⭐⭐⭐          |

**Recommended: `qwen2.5:14b`** — best tool calling reliability on your hardware.

---

## 📁 Project Structure

```
local-agent/
├── agent.py          # Main agent script
├── requirements.txt  # Python dependencies
└── README.md         # This file
```
