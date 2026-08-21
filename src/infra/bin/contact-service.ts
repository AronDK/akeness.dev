import * as path from "node:path"
import { fileURLToPath } from "node:url"
import * as cdk from "aws-cdk-lib"
import { config as loadEnvironment } from "dotenv"
import { loadContactDeploymentConfiguration } from "../lib/deployment-configuration"
import { ContactServiceStack } from "../lib/contact-service-stack"

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))

loadEnvironment({
  path: path.resolve(currentDirectory, "../../.env"),
})

const app = new cdk.App()
const configuration = loadContactDeploymentConfiguration()

new ContactServiceStack(app, "AkenessContactServiceStack", configuration, {
  stackName: "akeness-contact-service",
  description: "Secure email delivery for the akeness contact form.",
})
