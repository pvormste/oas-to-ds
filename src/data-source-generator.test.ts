import {buildASTSchema, parse} from "graphql";
import {DataSourceGenerator} from "./data-source-generator";
import {GraphQLSchema} from "graphql/type";
import {printSchema} from "graphql/utilities";

const fs = require("fs");
const PET_STORE_OAS_FILE_PATH = "src/oas/petstore.json";
const PET_STORE_SCHEMA_FILE_PATH = "src/expectations/petstore.graphqls";

const readFileAsString = (filepath: string) => {
    return fs.readFileSync(filepath, "utf8");
}

const readFileAsGraphQLAST = (filepath: string) => {
    const expectedSchemaString = readFileAsString(filepath);
    return buildASTSchema(parse(expectedSchemaString));
}

const printSchemas = (actualSchema: GraphQLSchema, expectedSchema: GraphQLSchema) => {
    return {actualSchema: printSchema(actualSchema), expectedSchema: printSchema(expectedSchema)}
}

test("should generate GraphQL schema from OAS", async () => {
    const dsg = new DataSourceGenerator(readFileAsString(PET_STORE_OAS_FILE_PATH));
    const actualSchemaAST = await dsg.generateGraphQLSchemaAST();
    const expectedSchemaAST = readFileAsGraphQLAST(PET_STORE_SCHEMA_FILE_PATH);

    const {actualSchema, expectedSchema} = printSchemas(actualSchemaAST, expectedSchemaAST);
    expect(actualSchema).toBe(expectedSchema);
});

test("should generate a data source", async () => {
    const dsg = new DataSourceGenerator(readFileAsString(PET_STORE_OAS_FILE_PATH));
    const dataSource = await dsg.generateDataSource("name", "http://countries.trevlorblades.com");
    //console.log(dataSource);
    console.log(JSON.stringify(dataSource, null, 4));
});
