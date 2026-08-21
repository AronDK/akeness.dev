import * as path from "node:path"
import { fileURLToPath } from "node:url"
import * as cdk from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs"
import * as logs from "aws-cdk-lib/aws-logs"
import * as wafv2 from "aws-cdk-lib/aws-wafv2"
import { Construct } from "constructs"
import type { ContactDeploymentConfiguration } from "./deployment-configuration"

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const stageName = "prod"

export class ContactServiceStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    configuration: ContactDeploymentConfiguration,
    props?: cdk.StackProps,
  ) {
    super(scope, id, props)

    const functionLogGroup = new logs.LogGroup(this, "ContactFunctionLogGroup", {
      logGroupName: "/aws/lambda/akeness-contact",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    const apiAccessLogGroup = new logs.LogGroup(this, "ContactApiAccessLogGroup", {
      logGroupName: "/aws/apigateway/akeness-contact",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    const contactFunctionRole = new iam.Role(this, "ContactFunctionRole", {
      roleName: "akeness-contact-lambda-role",
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "Executes the akeness contact-form sender.",
    })

    functionLogGroup.grantWrite(contactFunctionRole)

    // SES evaluates SendEmail authorization against request context as well as
    // identities. Resource "*" avoids a service-side identity resolution mismatch;
    // the exact source and destination conditions preserve functional least privilege.
    contactFunctionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "SendOnlyConfiguredContactEmail",
        actions: ["ses:SendEmail"],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "ses:FromAddress": configuration.fromEmail,
          },
          "ForAllValues:StringEquals": {
            "ses:Recipients": configuration.recipientEmail,
          },
          Null: {
            "ses:Recipients": "false",
          },
        },
      }),
    )

    const contactFunction = new NodejsFunction(this, "ContactFunction", {
      functionName: "akeness-contact",
      description: "Validates and sends website contact-form submissions.",
      entry: path.join(currentDirectory, "../lambda/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      role: contactFunctionRole,
      environment: {
        CONTACT_RECIPIENT_EMAIL: configuration.recipientEmail,
        SES_FROM_EMAIL: configuration.fromEmail,
        ALLOWED_ORIGINS: configuration.allowedOrigins.join(","),
        CONTACT_PROXY_PUBLIC_KEY: configuration.proxyPublicKey,
      },
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: false,
        target: "node22",
      },
    })

    const api = new apigateway.RestApi(this, "ContactApi", {
      restApiName: "akeness-contact-api",
      description: "Public endpoint for the akeness website contact form.",
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      deployOptions: {
        stageName,
        metricsEnabled: true,
        throttlingRateLimit: 5,
        throttlingBurstLimit: 10,
        accessLogDestination: new apigateway.LogGroupLogDestination(
          apiAccessLogGroup,
        ),
        accessLogFormat: apigateway.AccessLogFormat.custom(
          JSON.stringify({
            requestId: "$context.requestId",
            extendedRequestId: "$context.extendedRequestId",
            method: "$context.httpMethod",
            path: "$context.resourcePath",
            status: "$context.status",
            responseLength: "$context.responseLength",
            responseLatency: "$context.responseLatency",
            integrationStatus: "$context.integration.status",
          }),
        ),
      },
    })

    const contactResource = api.root.addResource("contact")
    const contactIntegration = new apigateway.LambdaIntegration(contactFunction, {
      proxy: true,
    })

    contactResource.addMethod("POST", contactIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    })
    contactResource.addMethod("OPTIONS", contactIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    })

    const webAcl = new wafv2.CfnWebACL(this, "ContactWebAcl", {
      name: "akeness-contact-web-acl",
      scope: "REGIONAL",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "akeness-contact-web-acl",
        sampledRequestsEnabled: false,
      },
      rules: [
        {
          name: "RateLimitPerIp",
          priority: 0,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              aggregateKeyType: "FORWARDED_IP",
              evaluationWindowSec: 300,
              forwardedIpConfig: {
                fallbackBehavior: "MATCH",
                headerName: "X-Forwarded-For",
              },
              limit: 100,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "akeness-contact-rate-limit",
            sampledRequestsEnabled: false,
          },
        },
      ],
    })

    const webAclAssociation = new wafv2.CfnWebACLAssociation(
      this,
      "ContactWebAclAssociation",
      {
        resourceArn: `arn:${this.partition}:apigateway:${this.region}::/restapis/${api.restApiId}/stages/${stageName}`,
        webAclArn: webAcl.attrArn,
      },
    )
    webAclAssociation.node.addDependency(api.deploymentStage)

    new cdk.CfnOutput(this, "ContactApiUrl", {
      value: api.urlForPath("/contact"),
      description:
        "Configure this HTTPS endpoint as the CONTACT_API_URL Cloudflare Worker secret.",
    })
  }
}
