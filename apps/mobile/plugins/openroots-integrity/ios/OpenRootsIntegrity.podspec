require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))
Pod::Spec.new do |s|
  s.name = 'OpenRootsIntegrity'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.license = { :type => 'MIT' }
  s.author = 'OpenRoots contributors'
  s.homepage = 'https://github.com/expo/expo'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
