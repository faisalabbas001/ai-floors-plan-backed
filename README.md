# AI Floor Plan Generator - Backend

Enterprise-grade Node.js backend for AI-powered architectural floor plan generation.

## Overview

This backend provides:
- **Authentication API** - Secure user signup/login with JWT
- **AI Planner API** - Natural language to structured architectural plans using OpenAI

## Tech Stack

- Node.js + Express.js
- MongoDB + Mongoose
- OpenAI SDK (GPT-4o)
- JWT Authentication
- Zod Validation
- bcrypt Password Hashing

## Project Structure

```
Backed_SIde/
├── src/
│   ├── index.js              # Entry point
│   ├── server.js             # Server bootstrap
│   ├── app.js                # Express app setup
│   │
│   ├── config/
│   │   ├── env.js            # Environment variables
│   │   ├── db.js             # MongoDB connection
│   │   └── openai.js         # OpenAI client
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.model.js
│   │   │   ├── auth.validation.js
│   │   │   ├── auth.service.js
│   │   │   ├── auth.controller.js
│   │   │   └── auth.routes.js
│   │   │
│   │   └── planner/
│   │       ├── planner.prompt.js
│   │       ├── planner.validation.js
│   │       ├── planner.service.js
│   │       ├── planner.controller.js
│   │       └── planner.routes.js
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   └── error.middleware.js
│   │
│   └── utils/
│       ├── logger.js
│       └── response.js
│
├── .env.example
├── package.json
└── README.md
```

## Quick Start

### 1. Install Dependencies

```bash
cd Backed_SIde
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
MONGODB_URI=mongodb://localhost:27017/ai-floor-plan
JWT_SECRET=your-secret-key-here
OPENAI_API_KEY=sk-your-openai-key
```

### 3. Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:5000`

### 4. Start Production Server

```bash
npm start
```

## API Endpoints

### Health Check

```
GET /health
```

### Authentication

#### Signup
```
POST /api/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "..."
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

#### Get Profile (Protected)
```
GET /api/auth/profile
Authorization: Bearer <token>
```

### AI Planner

#### Generate Plan (Protected)
```
POST /api/planner/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "Design a bank branch in Lahore DHA with basement and ground floor",
  "meta": {
    "buildingType": "Bank",
    "city": "Lahore",
    "authority": "DHA",
    "plotArea": 5000,
    "floors": ["Basement", "Ground"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Plan generated successfully",
  "data": {
    "plan": {
      "buildingType": "Bank",
      "totalArea": 5000,
      "floors": [
        {
          "level": "Ground",
          "totalArea": 2500,
          "rooms": [
            {
              "name": "ATM Vestibule",
              "type": "service",
              "areaSqft": 120,
              "dimensions": { "length": 12, "width": 10 }
            },
            {
              "name": "Teller Area",
              "type": "operations",
              "areaSqft": 400,
              "dimensions": { "length": 20, "width": 20 }
            }
          ],
          "circulation": {
            "type": "central",
            "corridorWidth": 6
          }
        }
      ],
      "compliance": {
        "authority": "DHA",
        "setbacks": { "front": 20, "rear": 10, "sides": 8 },
        "notes": ["DHA compliant layout"]
      }
    },
    "usage": {
      "promptTokens": 1500,
      "completionTokens": 800,
      "totalTokens": 2300
    }
  }
}
```

## Meta Options

The `meta` object in planner requests accepts:

| Field | Type | Description |
|-------|------|-------------|
| `buildingType` | string | Bank, Residential, Commercial, Hospital, etc. |
| `city` | string | City name |
| `authority` | string | DHA, LDA, CDA, etc. |
| `plotArea` | number | Plot area in sqft |
| `floors` | string[] | Required floors (Basement, Ground, First, etc.) |
| `budget` | string | Budget range |
| `style` | string | Architectural style |
| `specialRequirements` | string[] | Special features/requirements |

## Error Handling

All errors follow consistent format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | development | Environment mode |
| `PORT` | No | 5000 | Server port |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `JWT_SECRET` | Yes | - | JWT signing secret |
| `JWT_EXPIRES_IN` | No | 7d | Token expiration |
| `OPENAI_API_KEY` | Yes | - | OpenAI API key |
| `OPENAI_MODEL` | No | gpt-4o | OpenAI model |
| `CORS_ORIGIN` | No | http://localhost:3000 | Frontend URL |

## Frontend Integration

Use the token from login/signup in all protected requests:

```javascript
const response = await fetch('http://localhost:5000/api/planner/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    prompt: 'Design a 3-bedroom house',
    meta: { buildingType: 'Residential', plotArea: 2000 }
  })
});
```

## Future Roadmap

- [ ] OpenAI Agent SDK integration
- [ ] Tool calling for complex designs
- [ ] Revit/Dynamo automation
- [ ] AutoCAD file generation
- [ ] Job queue for long-running tasks

## License

MIT
