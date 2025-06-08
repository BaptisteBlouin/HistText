# HistText Administrator's Guide

## Table of Contents
1. [Installation](#installation)
   - [System Requirements](#system-requirements)
   - [Repository Setup](#repository-setup)
   - [Directory Structure](#directory-structure)
   - [Environment Configuration](#environment-configuration)
2. [Deployment](#deployment)
   - [Docker Configuration](#docker-configuration)
   - [Starting the Application](#starting-the-application)
   - [Verifying Successful Deployment](#verifying-successful-deployment)
3. [Initial Access](#initial-access)
   - [Login Credentials](#login-credentials)
   - [Administrator Dashboard](#administrator-dashboard)
4. [Solr Database Management](#solr-database-management)
   - [SSH Key Configuration](#ssh-key-configuration)
   - [Adding a Solr Database Connection](#adding-a-solr-database-connection)
   - [Establishing SSH Connection](#establishing-ssh-connection)
   - [Configuring Database Information](#configuring-database-information)
   - [Setting Database Permissions](#setting-database-permissions)
5. [User Management](#user-management)
   - [Creating and Modifying Users](#creating-and-modifying-users)
   - [User Roles](#user-roles)
   - [Role Permissions](#role-permissions)
6. [Advanced Features](#advanced-features)
   - [API Documentation](#api-documentation)
   - [NLP Management](#nlp-management)
     - [Named Entity Recognition](#named-entity-recognition)
     - [Tokenization](#tokenization)
     - [Word Embeddings](#word-embeddings)
7. [Switching to User Interface](#switching-to-user-interface)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)

## Installation

### System Requirements
- Docker and Docker Compose
- Git
- SSH client for Solr database connections
- Sufficient disk space for embeddings and database storage

### Repository Setup
Clone the HistText repository to your server:

```bash
git clone https://github.com/BaptisteBlouin/hisstext.git
cd histtext
```

### Directory Structure
Create the necessary directory structure for storing data:

```bash
# Create all required directories
mkdir -p data/postgres data/solr data/histtext-tmp data/ssh data/embeddings
```

Each directory serves a specific purpose:
- `data/postgres`: PostgreSQL database files
- `data/solr`: Local Solr data 
   - You may need to do : `chown 1000:1000 data/solr` according to the `user: "1000:1000"` set in `docker-compose.yml`
- `data/histtext-tmp`: Temporary files used by the application
- `data/ssh`: SSH keys for remote Solr connections
- `data/embeddings`: Word embedding models

### Environment Configuration
Copy the example environment file and customize it for your deployment:

```bash
cp .env.example .env
vim .env
```

Important environment variables to configure (verified from `app/backend/config.rs`):

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:password@postgres:15432/databasename` (Docker)<br>`postgres://user:password@localhost:5432/databasename` (Local) |
| `SECRET_KEY` | Application security key (required) | Generate a 256-bit secure random string |
| `SOLR_NER_PORT` | Port for NER Solr instance | `8982` |
| `PATH_STORE_FILES` | Temporary files storage path | `/data/histtext-tmp` |
| `EMBED_PATH` | Path to word embeddings file | `/data/embeddings/glove.6B.50d.txt` |
| `MAX_SIZE_QUERY` | Maximum query size limit | `20000` |
| `MAX_EMBEDDINGS_FILES` | Max embeddings files to cache | `3` |
| `MAIL_FROM` | Email sender address (optional) | `noreply@your-domain.com` |
| `MAIL_REPLY_TO` | Email reply-to address (optional) | `support@your-domain.com` |

**Core Required Variables:**
- `DATABASE_URL`: PostgreSQL connection (required)
- `SECRET_KEY`: 256-bit security key (required)
- `SOLR_NER_PORT`: Solr port configuration (default: 8982)

**Storage Configuration:**
- `PATH_STORE_FILES`: Directory for temporary processing files
- `EMBED_PATH`: Path to pre-trained word embeddings file

**Performance Tuning:**
- `MAX_SIZE_QUERY`: Controls maximum query result size
- `MAX_EMBEDDINGS_FILES`: Limits embeddings cache size

> **Important:** For production environments, ensure all passwords and keys are strong and unique. Never use default values.

## Deployment (Refer to the main README if you don't want to use docker.)

### Docker Configuration
Review and modify the Docker Compose file if needed:

```bash
vim docker-compose.yml
```

Key components in the Docker setup:
- PostgreSQL database container
- Solr container
- HistText application container
- Network and volume configurations

### Starting the Application
Build and start the Docker containers:

```bash
# Build containers (use --no-cache to ensure fresh builds)
docker-compose build --no-cache

# Start the application stack
docker-compose up
```

For production environments, run in detached mode:

```bash
docker-compose up -d
```

### Verifying Successful Deployment
Monitor the console output during startup. A successful deployment will show:

1. Database initialization messages:
```
Running initialization script...
Admin user created with ID: 1
Admin role assigned to user ID: 1
Role permission (Admin, admin) inserted.
```

2. Application startup messages:
```
Setting up and starting frontend...
Starting backend with cargo watch...
Frontend process (npm start) running with PID: 43
Backend process (cargo watch) running with PID: 44
```

3. Server ready message:
```
INFO [actix_server::builder] starting 16 workers
```

Once you see these messages, the application is fully operational.

## Initial Access

### Login Credentials
Navigate to the application URL defined in your `.env` file:

```
http://localhost:3000/
```

![](images/localhost.png)

Log in with the default administrator credentials:
```
http://localhost:3000/login
```
![](images/loginadmin.png)

- Username: `admin`
- Password: `admin`

> **Security Warning:** Change these default credentials immediately after your first login.

### Administrator Dashboard
After logging in, you'll be directed to the administrator dashboard. This central interface provides access to all administrative functions:

- Solr Management
- User & Role Management
- NLP Management
- API Documentation
- System Configuration

![](images/admindash.png)

## Solr Database Management
The HistText application requires connection to at least one Solr database containing text collections.

### SSH Key Configuration
If your Solr database is on a remote server, copy your SSH key to the appropriate directory:

```bash
cp -r ~/.ssh/your_key.* data/ssh/
```

Ensure proper permissions on the SSH key:
```bash
chmod 600 data/ssh/your_key
```

### Adding a Solr Database Connection
1. Navigate to the "SOLR MANAGEMENT" tab
2. Select the "Databases" sub-tab
3. Click "Add New Database"
4. Complete the connection form:
   - **Name**: A descriptive name for this Solr instance
   - **URL**: The hostname or IP address of the Solr server
   - **Server port**: The port Solr is running on the remote server (typically 8983)
   - **Local Port**: The port to use locally for the SSH tunnel (choose an available port)

![](images/addsolr2.png)

### Establishing SSH Connection
After adding the database connection:

1. Click the "Connect SSH" button for your newly added Solr database
2. Verify the connection status changes to "Connected"
3. Check the "Connection Status" message for any errors

![](images/connecttossh2.png)

A successful connection will display:
```
SSH tunnel established successfully
```

![](images/ssh_correct.png)

> **Automatic Tunnel Management**: SSH tunnels are automatically established on server startup and monitored for connectivity. The application manages tunnel lifecycle, including cleanup on shutdown. See `docs/ARCHITECTURE.md` for implementation details.

### Configuring Database Information
For each Solr collection you want to use:

1. Navigate to the "Database Info" tab
2. Select a collection from the dropdown menu
3. Configure the following settings:
   - **Description**: Informative text shown when users hover over the collection
   - **Embeddings**: Path to word embeddings for this collection
     - Use `none` to disable embeddings
     - Use `default` to use the path specified in `EMBED_PATH` environment variable
     - Use a custom path for collection-specific embeddings
   - **Language**: The primary language of the collection
   - **Text Field**: The Solr field containing the primary document text
   - **Tokenizer**: Enable/disable tokenization (primarily for Chinese text)
   - **Field To Not Display**: Fields to exclude from the user interface
![](images/solrinfo.png)

4. Click "ADD" to apply the configuration

![](images/solrinfo1.png)


### Setting Database Permissions
Define access permissions for each collection:

1. Navigate to the "Database Permissions" tab
2. Complete the form:
   - **Permission**: A descriptive name (e.g., `free`, `view_historical_documents`)
   - **Database**: Select the Solr database
   - **Collection**: Select the specific collection
3. Click "ADD" to apply the configuration

These permissions will later be assigned to user roles.

![](images/dataPermissions.png)

## User Management

### Creating and Modifying Users
1. Navigate to the "USERS & ROLE MANAGEMENT" tab
2. Select the "Users" sub-tab
3. To create a new user, complete the form:  
   - **Email**: User's email address
   - **Password**: Initial password (users can change this later)
   - **First Name**: User's first name
   - **Last Name**: User's last name
   - **Active**: Toggle to enable/disable the account
4. Click "Add User"
5. To modify an existing user, click the "Edit" button next to their entry

![](images/testuser.png)

### User Roles
Assign roles to control user access:

1. Navigate to the "User Roles" tab
2. Select a user from the dropdown menu
3. Select a role from the available options or create a new role
4. Click "ADD" to assign the role

![](images/UserRole.png)

Users can have multiple roles if needed.

### Role Permissions
Connect roles to database permissions:

1. Navigate to the "Role Permissions" tab
2. Complete the form:
   - **Role**: Select the user role
   - **Permission**: Select a previously created database permission
3. Click "ADD" to establish the connection

This three-tier system (User → Role → Permission) provides flexible access control to your Solr collections.

![](images/RolePermission.png)


## Advanced Features

### API Documentation
Access the API documentation to understand available endpoints:

1. Navigate to the "API DOCUMENTATION" tab
2. Click "Open API Documentation"
3. Enter the API documentation credentials (configured in `.env`)
4. Browse the Swagger UI to explore available endpoints

![](images/apidoc.png)

To authenticate API requests for testing:
1. Go to your user "Account" page
2. Copy your authentication token
3. In Swagger UI, click "Authorize" and paste the token

![](images/swagger.png)

### NLP Management
HistText provides interfaces to perform NLP operations on your Solr collections.

![](images/HistTextTool.png)

> **Advanced NLP Operations**: For more advanced NLP processing, the separate HistText Toolkit provides a Python CLI and FastAPI interface with 15+ model types. See `docs/TOOLKIT.md` for integration details and `toolkit/README.md` for complete toolkit documentation.


#### Named Entity Recognition
Extract named entities from your text collections:

1. Navigate to the "NLP MANAGEMENT" tab
2. Select the "NAMED ENTITY RECOGNITION" sub-tab
3. Configure the NER process:
   - **Solr Database**: Target Solr instance
   - **Collection**: Target collection
   - **Text Field**: Field containing text to analyze
   - **Cache Output Dir**: Where to store the extracted entities
   - **Model Name**: NER model to use

4. Click "Generate Command" to create the execution command
5. Copy the command and run it on your NLP processing environment

![](images/NER.png)


#### Tokenization
Tokenize text (especially useful for languages like Chinese):

1. Navigate to the "TOKENIZATION" tab
2. Configure the tokenization process:
   - **Solr Database**: Target Solr instance
   - **Collection**: Target collection
   - **Text Field**: Field containing text to tokenize
   - **Cache Output Dir**: Where to store the tokenized text

3. Click "Generate Command" to create the execution command
4. Copy and run the command on your processing environment

![](images/tokenization.png)

#### Word Embeddings
Create word embeddings from your collections:

1. Navigate to the "WORD EMBEDDINGS" tab
2. Configure the embedding generation:
   - **Solr Database**: Source Solr instance
   - **Collection**: Source collection
   - **Text Field**: Field containing text to analyze
   - **Output Directory**: Where to save the generated embeddings

3. Click "Generate Command" to create the execution command
4. Run the command on a suitable machine (embeddings can require significant computing resources)
5. Once generated, update the collection's embedding path in "Database Info"

![](images/embeddings.png)


## Switching to User Interface
To access the standard user interface:

1. Click on the HistText logo in the top-left corner
2. Select a Solr database from the dropdown
3. Choose a collection to work with

![](images/collectionselection.png)

Refer to the User Manual for detailed information on these features.

## Troubleshooting

### Common Issues

| Problem | Possible Solution |
|---------|------------------|
| Docker containers fail to start | Check disk space and container logs with `docker-compose logs` |
| SSH connection failure | Verify SSH key permissions and connectivity to the Solr server |
| Database not appearing | Ensure Solr is running and accessible on the specified port |
| API documentation not loading | Verify `DO_OPENAPI` is set to `true` in `.env` |
| NLP commands fail | Check that required Python packages are installed on the processing machine |

For persistent issues, check the application logs:
```bash
docker-compose logs -f app
```

## Security Considerations

1. **Change Default Credentials**: Immediately change the default admin username and password
2. **Environment Variables**: Never expose your `.env` file or its contents
3. **Role-Based Access**: Implement the principle of least privilege when assigning permissions
4. **Network Security**: Consider placing HistText behind a reverse proxy with HTTPS
5. **Regular Updates**: Keep the application and all dependencies updated

Following these security practices will help maintain the integrity and confidentiality of your text data and analysis.