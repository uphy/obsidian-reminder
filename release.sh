#!/bin/bash

VERSION=$1
MINIMUM_OBSIDIAN_VERSION=0.12.12

if [ -z "$1" ]; then
    echo Specify a version
    exit 1
fi

echo $VERSION | egrep '^\d+\.\d+\.\d+$'
if [ $? -ne 0 ]; then
    echo "Invalid version format: $VERSION"
    exit 1
fi

sed -i '' -e 's/"version": .*/"version": "'$VERSION'",/' package.json
sed -i '' -e 's/"version": .*/"version": "'$VERSION'",/' manifest.json

VERSIONS_FILE_TEMP=$(mktemp)
jq '. + {"'$VERSION'": "'$MINIMUM_OBSIDIAN_VERSION'"}' versions.json > $VERSIONS_FILE_TEMP
mv $VERSIONS_FILE_TEMP versions.json

git add .
git commit -m "Release v$VERSION"
git tag $VERSION
git push
git push --tags

npm run build
gh release create "$VERSION" --notes "$VERSION" main.js styles.css manifest.json
