pipeline {
    agent any

    environment {
        DOCKERHUB_USERNAME = 'fire2686'
        BACKEND_IMAGE = "${DOCKERHUB_USERNAME}/assemblemonitor-backend"
        FRONTEND_IMAGE = "${DOCKERHUB_USERNAME}/assemblemonitor-frontend"
        IMAGE_TAG = "${BUILD_NUMBER}"
        
	// update the ip address
	EC2_HOST = '98.92.225.249' 
        EC2_USER = 'ubuntu'
        EC2_PROJECT_DIR = '/home/ubuntu/AssebmleMonitor-DevOps'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Show Workspace') {
            steps {
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
                sshagent(credentials: ['ec2-ssh-key']) {
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
        success {
            echo 'CI/CD pipeline completed successfully.'
        }

        failure {
            echo 'CI/CD pipeline failed. Check logs above.'
        }

        always {
            sh 'docker logout || true'
        }
    }
}
