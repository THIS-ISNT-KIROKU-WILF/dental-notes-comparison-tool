# Dental Notes Comparison Tool

An AI-powered tool for evaluating and comparing dental notes against original transcripts. Uses ChatGPT o3 to assess notes on detail level, truthfulness, and identify any falsehoods.

## 🚀 Features

- **Individual Upload**: Upload one transcript with multiple note versions
- **Batch Processing**: Upload ZIP files containing multiple transcript/note sets
- **AI Evaluation**: Uses OpenAI GPT models to evaluate notes on three key criteria:
  - **Detail Level** (1-10): Comprehensiveness compared to transcript
  - **Truthfulness** (1-10): Accuracy of information
  - **Falsehood Detection**: Identifies specific inaccuracies with severity levels
- **Cross-Transcript Analysis**: For batch uploads, compares note types across transcripts
- **Modern Interface**: Drag-and-drop uploads, real-time results, responsive design

## 🛠️ Technology Stack

- **Frontend**: Next.js 15.4.5, React 19.1.0, TypeScript 5.8.3
- **UI**: Tailwind CSS v4.0+, Modern drag-and-drop interface
- **AI Integration**: OpenAI JavaScript SDK 5.11.0, @ai-sdk/openai 1.3.23
- **File Processing**: Multer (uploads), Yauzl (ZIP extraction)
- **Runtime**: Node.js 20.19.3 LTS

## 📋 Prerequisites

- Node.js 20.19.3+ 
- OpenAI API key with GPT model access
- Modern web browser

## 🔧 Installation

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd dental-notes-comparison
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-proj-your-actual-api-key-here
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```
   
   Visit http://localhost:3000

## 📁 File Structure Requirements

### Individual Upload
- Upload one transcript file
- Upload multiple note files for comparison

### Batch Upload (ZIP)
ZIP file should contain directories with this structure:
```
transcript1/
├── transcript.txt
├── notes-gpt4o.txt
├── notes-claude.txt
└── notes-gemini.txt

transcript2/
├── transcript.txt
├── notes-gpt4o.txt
├── notes-claude.txt
└── notes-gemini.txt
```

**Requirements:**
- Each directory represents one case/patient
- Must contain a file with "transcript" in the name
- Note files can have any names (automatically grouped by filename)
- Supported formats: `.txt`, `.md`, `.pdf`, `.docx`

## 🧪 Testing with Sample Data

Sample test data is included in the `test-data/` directory:

1. **Individual Test**: Use files from `test-data/transcript1/`
2. **Batch Test**: Upload `test-data/sample-batch.zip`

The sample data includes realistic dental visit scenarios with different note-taking styles.

## 📊 Evaluation Criteria

### Detail Score (1-10)
- Completeness of clinical information
- Documentation of procedures and findings
- Inclusion of relevant context

### Truthfulness Score (1-10)
- Factual accuracy compared to transcript
- Proper representation of events
- Absence of misleading statements

### Falsehood Detection
- **High Severity**: Critical clinical inaccuracies
- **Medium Severity**: Notable but non-critical errors
- **Low Severity**: Minor discrepancies

## 🔄 API Endpoints

### Upload Individual Files
```bash
POST /api/upload
Content-Type: multipart/form-data

# Form data:
# transcript: File
# notes: File[] (multiple files)
```

### Upload Batch (ZIP)
```bash
POST /api/upload/batch
Content-Type: multipart/form-data

# Form data:
# zipFile: File (.zip)
```

### Get Evaluations
```bash
# Individual session
GET /api/evaluate?sessionId=session_123

# Batch session  
GET /api/evaluate?batchId=batch_123
```

### Trigger Evaluation
```bash
POST /api/evaluate
Content-Type: application/json

{
  "transcriptText": "...",
  "noteText": "...", 
  "noteFileName": "notes-gpt4o.txt",
  "transcriptName": "session_123"
}
```

## 🎯 Use Cases

### Medical Education
- Compare student notes against gold standards
- Identify common documentation gaps
- Train on proper clinical documentation

### Quality Assurance
- Audit medical record accuracy
- Standardize documentation practices
- Identify systematic errors

### Research
- Analyze documentation patterns
- Compare AI vs human note-taking
- Study clinical communication effectiveness

## ⚙️ Configuration

### Environment Variables
```bash
# Required
OPENAI_API_KEY=sk-proj-...

# Optional (with defaults)
MAX_INDIVIDUAL_FILE_SIZE=10MB
MAX_ZIP_FILE_SIZE=50MB
UPLOAD_DIRECTORY=./uploads
```

### Supported File Types
- **Text**: `.txt`, `.md`
- **Documents**: `.pdf`, `.docx` (future versions)

## 🐛 Troubleshooting

### Common Issues

**"No OpenAI API key found"**
- Ensure `.env.local` exists with valid `OPENAI_API_KEY`
- Restart development server after adding the key

**"ZIP structure invalid"**
- Each subdirectory must contain a transcript file
- Transcript filename should contain "transcript"
- At least one note file per directory required

**"File upload failed"**
- Check file size limits (10MB individual, 50MB ZIP)
- Ensure supported file formats
- Verify network connection

**"Evaluation failed"**
- Check OpenAI API key validity and credits
- Verify model access permissions
- Check for rate limiting

### Debug Mode
Enable detailed logging:
```bash
NODE_ENV=development npm run dev
```

## 🚀 Production Deployment

### Environment Setup
```bash
# Build application
npm run build

# Start production server
npm start
```

### Security Considerations
- Store API keys securely (never in code)
- Implement file upload validation
- Set appropriate file size limits
- Use HTTPS in production
- Sanitize user inputs

### Performance Optimization
- Enable caching for API responses
- Implement request rate limiting
- Use CDN for static assets
- Monitor OpenAI API usage and costs

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for GPT models and API
- Next.js team for the excellent framework
- Vercel for AI SDK and deployment platform
- The dental/medical community for validation and feedback

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review OpenAI API documentation

---

**Built with ❤️ using Next.js 15.4.5, React 19.1.0, and TypeScript 5.8.3**