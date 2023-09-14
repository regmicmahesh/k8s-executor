SHELL := /bin/bash

export APP_ROOT := $(shell pwd)

-include $(APP_ROOT)/env/Makefile.override

export K8S_TOKEN = $(shell aws eks get-token --cluster-name $(CLUSTER_NAME) --region $(AWS_REGION) --profile $(AWS_PROFILE) | jq -r ".status.token")

dev:
	@yarn dev
