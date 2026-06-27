pipeline {
    agent any

    environment {
        // Define Docker Hub credentials and image repository details
        DOCKERHUB_USERNAME = 'fire2686'
        BACKEND_IMAGE = "${DOCKERHUB_USERNAME}/assemblemonitor-backend"
        FRONTEND_IMAGE = "${DOCKERHUB_USERNAME}/assemblemonitor-frontend"
        // Use the Jenkins build number to tag images uniquely
        IMAGE_TAG = "${BUILD_NUMBER}"
        
        // EC2 deployment server configuration
	// update the ip address
	EC2_HOST = '172.31.29.103' 
        EC2_USER = 'ubuntu'
        EC2_PROJECT_DIR = '/home/ubuntu/AssembleMonitor-DevOps'
    }

    stages {
        stage('Checkout') {
            steps {
                // Pull the latest source code from the configured SCM (e.g., Git)
                checkout scm
            }
        }

        stage('Show Workspace') {
            steps {
                // Debugging step to verify the current working directory and its contents
                sh '''
                    echo "Current directory:"
                    pwd

                    echo "Project files:"
                    ls -la
                '''
            }
        }

        stage('Build Backend Image') {
            steps {
                // Build the FastAPI backend image and tag it with both the build number and 'latest'
                sh '''
                    docker build \
                      -t ${BACKEND_IMAGE}:${IMAGE_TAG} \
                      -t ${BACKEND_IMAGE}:latest \
                      ./backend
                '''
            }
        }

        stage('Build Frontend Image') {
            steps {
                // Build the React frontend image and tag it with both the build number and 'latest'
                sh '''
                    docker build \
                      -t ${FRONTEND_IMAGE}:${IMAGE_TAG} \
                      -t ${FRONTEND_IMAGE}:latest \
                      ./frontend
                '''
            }
        }

        stage('Login to Docker Hub') {
            steps {
                // Securely fetch Docker Hub credentials from Jenkins and log in
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_TOKEN'
                )]) {
                    sh '''
                        echo "$DOCKER_TOKEN" | docker login -u "$DOCKER_USER" --password-stdin
                    '''
                }
            }
        }

        stage('Push Images') {
            steps {
                // Push all newly built and tagged images to the Docker Hub registry
                sh '''
                    docker push ${BACKEND_IMAGE}:${IMAGE_TAG}
                    docker push ${BACKEND_IMAGE}:latest

                    docker push ${FRONTEND_IMAGE}:${IMAGE_TAG}
                    docker push ${FRONTEND_IMAGE}:latest
                '''
            }
        }

        stage('Deploy to EC2') {
            steps {
                // Connect to the EC2 instance via SSH using the configured Jenkins credentials
                sshagent(credentials: ['ec2-ssh-key']) {
                    // Pull new images, start containers, run DB migrations, and clean up dangling images
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} "
                            cd ${EC2_PROJECT_DIR} &&
                            docker compose -f docker-compose.rds.yml pull &&
                            docker compose -f docker-compose.rds.yml up -d &&
                            docker compose -f docker-compose.rds.yml exec -T api alembic upgrade head &&
                            docker image prune -f
                        "
                    '''
                }
            }
        }
    }

    post {
        // Actions to perform depending on the pipeline outcome
        success {
            echo 'CI/CD pipeline completed successfully.'
        }

        failure {
            echo 'CI/CD pipeline failed. Check logs above.'
        }

        always {
            // Ensure Docker logs out regardless of build success or failure to avoid leaving stale credentials
            sh 'docker logout || true'
        }
    }
}
