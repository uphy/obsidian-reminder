.PHONY: build test lint dagger-build dagger-test

# Local build and test
build:
	npm run build

test:
	NODE_ENV=development npx jest --no-coverage

lint:
	npm run lint

# Dagger pipeline targets
dagger-build:
	cd ci && dagger call build --source-dir .. export --path ../dist

dagger-test:
	cd ci && dagger call test --source-dir ..
