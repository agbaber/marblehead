source "https://rubygems.org"

# Pin to the same versions GitHub Pages uses in production so local
# Jekyll output matches what visitors see.
# https://pages.github.com/versions/
gem "jekyll", "3.10.0"
gem "kramdown-parser-gfm"

# webrick is no longer bundled with Ruby >= 3.0; jekyll serve needs it.
gem "webrick", "~> 1.8"

# Ruby 3.4 removed base64, csv, and bigdecimal from the default gem set;
# Jekyll 3.10's transitive deps still require them.
gem "base64"
gem "csv"
gem "bigdecimal"
