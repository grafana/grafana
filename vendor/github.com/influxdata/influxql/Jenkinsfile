pipeline {
  agent {
    docker {
      image 'golang:1.13.15'
    }
  }

	environment {
		GOCACHE = "${WORKSPACE}/.go-cache"
	}

  stages {
    stage('Test') {
      steps {
        sh """
				mkdir -p $GOCACHE
        rm -f $WORKSPACE/test-results.{log,xml}
        cd $WORKSPACE
        go test -v | tee $WORKSPACE/test-results.log
        """
      }

      post {
        always {
          sh """

          if [ -e test-results.log ]; then
						mkdir -p /go/src/github.com/
            go get github.com/jstemmer/go-junit-report
            go-junit-report < $WORKSPACE/test-results.log > test-results.xml
          fi
          """
          junit "test-results.xml"
        }
      }
    }
  }
}
