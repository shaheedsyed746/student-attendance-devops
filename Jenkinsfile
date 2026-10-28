pipeline {
    agent any

    options {
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install dependencies') {
            steps {
                bat 'npm.cmd install'
            }
        }

        stage('Validate application') {
            steps {
                bat 'node --check server.js'
                bat 'npm.cmd test'
            }
        }

        stage('Build Docker image') {
            steps {
                bat '"C:\\Users\\shahe\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe" build -t student-attendance:1.0 .'
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully.'
        }
        failure {
            echo 'Pipeline failed. Review the stage results above.'
        }
    }
}