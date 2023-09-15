SHELL := /bin/bash

export APP_ROOT := $(shell pwd)

include $(APP_ROOT)/env/Makefile.override

export K8S_TOKEN = $(shell aws eks get-token --cluster-name $(CLUSTER_NAME) --region $(AWS_REGION) --profile $(AWS_PROFILE) | jq -r ".status.token")

export K8S_API_URL = $(API_URL)/api/v1/namespaces/$(NAMESPACE)/pods/$(POD_NAME)/exec?command=%2Fbin%2Fsh&container=nginx&stdin=true&stdout=true&stderr=true

dev:
	@yarn dev
