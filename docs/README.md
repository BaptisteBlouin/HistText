# HistText Documentation Index

Welcome to the comprehensive HistText documentation. This directory provides detailed technical documentation, guides, and references for users, administrators, and developers working with the HistText historical text analysis platform.

## Documentation Structure

### 📋 **Core Documentation**

#### [**ARCHITECTURE.md**](ARCHITECTURE.md)
Complete system architecture documentation covering:
- Multi-tier application design
- Component interactions and data flow
- Frontend and backend architecture details
- Security and performance architecture
- Database schema design
- Caching strategies and optimization

#### [**CONFIGURATION.md**](CONFIGURATION.md)
Comprehensive environment configuration reference including:
- Complete environment variables list with descriptions
- Security configuration and secrets management
- Database and Solr configuration options
- Performance tuning parameters
- Development vs production settings
- SSH tunneling and external service integration

#### [**API_REFERENCE.md**](API_REFERENCE.md)
Detailed backend API documentation featuring:
- Complete REST API endpoint reference
- Authentication and authorization details
- Request/response schemas and examples
- Error handling and status codes
- Interactive API documentation access
- Rate limiting and performance considerations

#### [**DEPLOYMENT.md**](DEPLOYMENT.md)
Production deployment and infrastructure guide covering:
- Docker deployment (recommended approach)
- Manual installation procedures
- Kubernetes deployment manifests
- SSL/TLS configuration with Nginx
- Database backup and restore procedures
- Performance optimization strategies
- Security hardening recommendations

#### [**TROUBLESHOOTING.md**](TROUBLESHOOTING.md)
Comprehensive troubleshooting and maintenance guide including:
- Common issues and diagnostic procedures
- Performance problem resolution
- Database and cache management
- Log analysis and monitoring
- Recovery procedures and disaster recovery
- Regular maintenance tasks and schedules

### 📚 **Specialized Documentation**

#### **Administrator Guide** (`admin_setup/`)
- **Status**: Active and comprehensive
- Complete visual setup guide with 96+ screenshots
- Step-by-step deployment and configuration procedures
- Database connection, SSH tunneling, and user management workflows
- Essential for production deployment and administration

#### **Database Schema** (`database/`)
- **Status**: Active and current
- Detailed PostgreSQL schema documentation
- Complete table descriptions with relationships
- Mermaid ER diagrams for visualization
- Migration procedures and schema evolution

#### **Python Toolkit** (`toolkit/`)
- **Status**: Active and extensively featured
- Comprehensive Python CLI toolkit for text processing
- FastAPI integration for web services
- Advanced NLP capabilities (NER, embeddings, tokenization)
- Support for multiple models (spaCy, Transformers, GLiNER)
- Generated Sphinx documentation with full API reference

#### **Backend API Documentation** (`backend/`)
- **Status**: Active rustdoc-generated documentation  
- Complete Rust backend API reference
- Auto-generated HTML documentation from code
- View with: `cargo doc --open`
- Detailed module and function documentation

#### **OpenAPI Specifications** (`api/`)
- **Status**: Runtime-generated API specifications
- Three separate API specs (User, Solr, HistText)
- Access interactive docs at: `http://localhost:3000/swagger-ui`
- JSON specifications available for external tools

## Quick Navigation

### For New Users
1. Start with the main [README.md](../README.md) for quick start
2. Review [CONFIGURATION.md](CONFIGURATION.md) for environment setup
3. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for installation

### For Developers
1. Read [ARCHITECTURE.md](ARCHITECTURE.md) for system understanding
2. Reference [API_REFERENCE.md](API_REFERENCE.md) for backend integration
3. Use [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for debugging

### For Administrators
1. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
2. Use [admin_setup/README.md](admin_setup/README.md) for visual setup guide
3. Configure using [CONFIGURATION.md](CONFIGURATION.md)
4. Maintain with [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Interactive Documentation

### Swagger UI
Access live, interactive API documentation when the application is running:
- **URL**: `http://localhost:3000/swagger-ui`
- **Authentication**: Use credentials from `OPENAPI_LOGIN`/`OPENAPI_PWD` environment variables
- **Features**: Complete API testing interface with authentication

### Generated Documentation
```bash
# Generate Rust backend documentation
cargo doc --open

# View database schema
diesel print-schema

# API specification export
curl http://localhost:3000/api/openapi.json > histtext-api.json
```

## Documentation Standards

### Writing Guidelines
- **Clarity**: Use simple language and clear examples
- **Structure**: Organize with headings and bullet points for scanning
- **Code Examples**: Include working examples with syntax highlighting
- **Completeness**: Cover both common and edge cases
- **Current**: Keep documentation synchronized with code changes

### Diagram Standards
- **Mermaid**: Used for architecture and flow diagrams
- **ASCII**: Simple text diagrams for code documentation
- **Screenshots**: For UI documentation (stored in relevant subdirectories)

## Contributing to Documentation

### How to Contribute
1. **Identify gaps**: Missing procedures, unclear explanations, outdated information
2. **Make changes**: Edit Markdown files directly
3. **Test examples**: Verify all code examples and commands work
4. **Submit PR**: Include documentation updates with code changes

### Maintenance Responsibilities
- **Code contributors**: Update relevant docs with code changes
- **Maintainers**: Review documentation accuracy during PR reviews
- **Users**: Report documentation issues and suggest improvements

### Documentation Updates
- **New features**: Document APIs, configuration options, and usage
- **Breaking changes**: Update all affected documentation sections
- **Configuration changes**: Update `CONFIGURATION.md` with new variables
- **Deployment changes**: Update `DEPLOYMENT.md` with new procedures

## Version Information

### Current Documentation Version
- **Version**: 1.1.0 (January 2025)
- **HistText Version**: 1.1.0
- **Last Updated**: January 2025

### Compatibility
- **Minimum HistText Version**: 1.0.0
- **Rust Version**: 1.85+
- **Node.js Version**: 18+
- **Docker Version**: 23.0+
- **PostgreSQL Version**: 15+
- **Apache Solr Version**: 9.4+

## Getting Help

### Documentation Issues
- **Unclear instructions**: Open an issue with specific questions
- **Missing information**: Request additional documentation sections
- **Errors**: Report inaccuracies with specific file and line references

### Support Channels
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: General questions and community support
- **Pull Requests**: Direct contributions and improvements

### Additional Resources
- **Main Repository**: [GitHub Repository](https://github.com/BaptisteBlouin/HistText)
- **Release Notes**: Check repository releases for version-specific changes
- **Roadmap**: See `ROADMAP.md` for planned features and improvements

## Acknowledgments

This documentation structure provides comprehensive coverage of HistText's capabilities while maintaining clarity and usability for different user types. The modular approach allows for easy maintenance and updates as the platform evolves.

Thank you for using HistText and contributing to its documentation!