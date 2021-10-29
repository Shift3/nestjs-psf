#!/bin/sh

set -e

if test "$1" != "patch" && test "$1" != "minor" && test "$1" != "major"; then
	echo 'Usage: ./publish.sh [patch|minor|major]'
	exit 1
fi

npm version $1
npm run build
npm publish
