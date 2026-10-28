pipeline {
  agent any
  options { timestamps() }
  stages {
    stage('Checkout') {
      steps { checkout scm }
    }
    stage('Install dependencies') {
      steps { sh 'npm install' }
    }
    stage('Validate application') {
      steps {
        sh 'node --check server.js'
        sh 'node --check public/app.js'
        sh 'npm test'
      }
    }
    stage('Build Docker image') {
      steps { sh 'docker build -t student-attendance:${BUILD_NUMBER} .' }
    }
  }
  post {
    always { echo 'Pipeline finished. Review the stage results above.' }
  }
}
