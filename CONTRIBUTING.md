# Contributing to HistText

Thank you for your interest in contributing to this project! This document provides guidelines and instructions for contributing.

## Licensing

By contributing to this project, you agree that your contributions will be licensed under the project's [dual license](LICENSE.md).

## Development Workflow

### Branching Strategy

We use a structured branching strategy:

- `main`: Production-ready code only
- `dev`: Integration branch for new features
- Feature branches: For new features (`feature/feature-name`)
- Release branches: For release preparation (`release/v1.1.0`)
- Hotfix branches: For critical fixes (`hotfix/issue-description`)

### Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/BaptisteBlouin/hisstext.git
cd histtext

# Install dependencies

# Create a feature branch
git checkout -b feature/your-feature-name
```

### Code Style

- Follow the existing code style
- Use consistent indentation (spaces/tabs as per project standard)
- Add comments for complex logic
- Include appropriate tests for new features


### Submitting Changes

1. Ensure your code passes all tests
2. Update documentation if necessary
3. Create a pull request against the `dev` branch
4. Include a clear description of the changes
5. Reference any related issues

### Pull Request Process

1. Update the README.md or documentation with details of changes if appropriate
2. Your PR requires at least one maintainer's approval
3. PRs are merged to `dev` first, then to `main` during releases

## Release Process

Releases follow semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR: Incompatible API changes
- MINOR: Backwards-compatible new functionality
- PATCH: Backwards-compatible bug fixes

## Communication

- For bugs and feature requests, open an issue on GitHub
- For questions, reach out via [blouinbaptiste @ gmail.com]

Thank you for contributing!
