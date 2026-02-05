# CloudDrive Backend

Node.js/Express API for the CloudDrive application. Handles authentication, file and folder management, S3 storage, and email workflows.

## Tech stack

- Node.js + Express
- MongoDB (Mongoose)
- AWS S3 (SDK v3)
- SendGrid for email
- JWT authentication

## Features

- Email/password authentication
- Account activation and password reset emails
- File upload, download, and metadata management
- Folder support (stored as file records with type = "folder")
- AI endpoints (Groq integration)
- Account deletion with S3 cleanup

## Setup

1) Install dependencies

```bash
npm install
```

2) Create `.env`

```env
PORT=5001
NODE_ENV=development

MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/cloudrive
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your_bucket_name

SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM_ADDRESS=you@example.com
EMAIL_FROM_NAME=CloudDrive
FRONTEND_URL=http://localhost:5173

GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MAX_TOKENS=1024
GROQ_TIMEOUT_MS=20000
GROQ_DEBUG=false
```

3) Run the server

```bash
npm run dev
```

The API will run on `http://localhost:5001` by default.

## Scripts

- `npm start` - Start the server
- `npm run dev` - Start with nodemon

## Key endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/activate/:token`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`
- `DELETE /api/auth/me`
- `GET /api/files`
- `POST /api/files/upload`
- `GET /api/folders`

## Notes

- SendGrid must have the sender address verified.
- Folders are stored in the `files` collection with `type = "folder"`.