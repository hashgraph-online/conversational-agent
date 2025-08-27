#!/usr/bin/env npx tsx

/**
 * Verify that the focused schema for InscribeHashinalTool is working correctly
 */

import { z } from 'zod';
import { FormValidatingToolWrapper } from '../src/langchain/FormValidatingToolWrapper';
import { FormGenerator } from '../src/forms/form-generator';

async function main() {
  console.log('🔍 Testing FormValidatingToolWrapper focused schema...\n');

  // Create mock form generator
  const mockFormGenerator: FormGenerator = {
    generateFormFromSchema: async (schema: any, input: any, options: any) => {
      console.log('📋 Form generation called with schema:');
      console.log('   Schema type:', typeof schema);
      console.log('   Schema constructor:', schema.constructor?.name);
      
      // Try different ways to access schema shape
      let schemaShape;
      let fields: string[] = [];
      
      if (schema._def?.shape) {
        schemaShape = schema._def.shape;
        fields = Object.keys(schemaShape);
        console.log('   Found shape via _def.shape');
      } else if (schema.shape) {
        schemaShape = schema.shape;
        fields = Object.keys(schemaShape);
        console.log('   Found shape via .shape');
      } else if (schema._def?.schema?.shape) {
        schemaShape = schema._def.schema.shape;
        fields = Object.keys(schemaShape);
        console.log('   Found shape via _def.schema.shape');
      } else {
        console.log('   ⚠️  Could not find schema shape, checking all properties...');
        console.log('   Schema keys:', Object.keys(schema));
        console.log('   Schema._def keys:', schema._def ? Object.keys(schema._def) : 'no _def');
      }
      
      console.log(`   Fields: [${fields.join(', ')}]`);
      console.log(`   Field count: ${fields.length}`);
      
      // Check if this is the focused schema (should have 5 fields)
      const isFocusedSchema = fields.length <= 5 && 
        fields.includes('name') && 
        fields.includes('description') && 
        fields.includes('creator');
        
      console.log(`   Is focused schema: ${isFocusedSchema ? '✅ YES' : '❌ NO'}`);
      
      if (!isFocusedSchema && fields.length > 0) {
        console.log('   ⚠️  PROBLEM: Schema has too many fields or missing essential fields');
        console.log('   Expected: [name, description, creator, attributes, type]');
        console.log(`   Got: [${fields.join(', ')}]`);
      }
      
      return {
        type: 'form',
        id: 'test-form',
        formConfig: {},
        originalPrompt: 'test',
        toolName: options.toolName
      } as any;
    }
  };

  // Create a mock tool that simulates InscribeHashinalTool
  const mockOriginalSchema = z.object({
    url: z.string().optional(),
    contentRef: z.string().optional(),
    base64Data: z.string().optional(),
    fileName: z.string().optional(),
    mimeType: z.string().optional(),
    name: z.string().optional(),
    creator: z.string().optional(),
    description: z.string().optional(),
    type: z.string().optional(),
    attributes: z.array(z.object({ trait_type: z.string(), value: z.union([z.string(), z.number()]) })).optional(),
    properties: z.record(z.unknown()).optional(),
    jsonFileURL: z.string().optional(),
    fileStandard: z.enum(['1', '6']).optional(),
    tags: z.array(z.string()).optional(),
    chunkSize: z.number().optional(),
    waitForConfirmation: z.boolean().optional(),
    timeoutMs: z.number().optional(),
    quoteOnly: z.boolean().optional(),
    withHashLinkBlocks: z.boolean().optional()
  });

  const mockOriginalTool = {
    name: 'inscribeHashinal',
    description: 'Mock InscribeHashinal tool',
    schema: mockOriginalSchema,
    _call: async () => 'mock result'
  };

  console.log(`📌 Mock tool name: ${mockOriginalTool.name}`);
  
  // Get the original schema field count
  const originalFields = Object.keys(mockOriginalSchema.shape);
  console.log(`📊 Original schema has ${originalFields.length} fields: [${originalFields.slice(0, 5).join(', ')}${originalFields.length > 5 ? ', ...' : ''}]`);

  // Wrap with FormValidatingToolWrapper
  const wrappedTool = new FormValidatingToolWrapper(
    mockOriginalTool as any,
    mockFormGenerator,
    {}
  );

  console.log(`🔧 Wrapped tool name: ${wrappedTool.name}\n`);

  // Test 1: Empty input (should trigger focused form)
  console.log('🧪 Test 1: Empty input (should trigger focused form generation)');
  try {
    const result1 = await wrappedTool._call({} as any);
    const parsed1 = JSON.parse(result1);
    
    if (parsed1.requiresForm) {
      console.log('✅ Form generation triggered as expected');
    } else {
      console.log('❌ Form generation was NOT triggered');
    }
  } catch (error) {
    console.log('❌ Test 1 failed:', error instanceof Error ? error.message : error);
  }

  // Test 2: Minimal input with just content source (should trigger focused form)
  console.log('\n🧪 Test 2: Input with just URL (should trigger focused form for metadata)');
  try {
    const result2 = await wrappedTool._call({ 
      url: 'https://example.com/image.jpg' 
    } as any);
    const parsed2 = JSON.parse(result2);
    
    if (parsed2.requiresForm) {
      console.log('✅ Form generation triggered as expected for metadata collection');
    } else {
      console.log('❌ Form generation was NOT triggered');
    }
  } catch (error) {
    console.log('❌ Test 2 failed:', error instanceof Error ? error.message : error);
  }

  // Test 3: Check that focused schema has correct structure
  console.log('\n🧪 Test 3: Direct focused schema validation');
  try {
    // Access the private method via prototype manipulation (for testing only)
    const wrapper = wrappedTool as any;
    const focusedSchema = wrapper.createFocusedInscribeHashinalSchema();
    
    console.log('   Focused schema type:', typeof focusedSchema);
    console.log('   Focused schema constructor:', focusedSchema.constructor?.name);
    console.log('   Focused schema._def keys:', focusedSchema._def ? Object.keys(focusedSchema._def) : 'no _def');
    console.log('   Focused schema keys:', Object.keys(focusedSchema));
    
    const focusedFields = Object.keys(focusedSchema._def?.shape || focusedSchema.shape || {});
    console.log(`📋 Focused schema fields: [${focusedFields.join(', ')}]`);
    console.log(`📊 Focused schema field count: ${focusedFields.length}`);
    
    // Let's also try to manually parse an object to see if the schema works
    console.log('\n🧪 Test 3b: Manual schema parsing test');
    try {
      const testInput = {
        name: 'Test NFT',
        description: 'Test description',  
        creator: 'Test creator'
      };
      const parseResult = focusedSchema.parse(testInput);
      console.log('✅ Focused schema parsing works:', parseResult);
    } catch (parseError) {
      console.log('❌ Focused schema parsing failed:', parseError instanceof Error ? parseError.message : parseError);
    }
    
    const expectedFields = ['name', 'description', 'creator', 'attributes', 'type'];
    const hasAllExpected = expectedFields.every(field => focusedFields.includes(field));
    const hasOnlyExpected = focusedFields.every(field => expectedFields.includes(field));
    
    if (hasAllExpected && hasOnlyExpected && focusedFields.length === 5) {
      console.log('✅ Focused schema has exactly the expected fields');
    } else {
      console.log('❌ Focused schema does not match expectations');
      console.log(`   Expected: [${expectedFields.join(', ')}]`);
      console.log(`   Got: [${focusedFields.join(', ')}]`);
    }
  } catch (error) {
    console.log('❌ Test 3 failed:', error instanceof Error ? error.message : error);
  }

  console.log('\n✨ Verification complete!');
}

main().catch(console.error);