import {
  caseBlockFallingIntoAThrowingDefault,
  caseFallingIntoAThrowingDefault,
  caseFallingIntoAThrowingDefaultAfterThousandsOfCases,
  caseFallingIntoAThrowingDefaultFromACatch,
  caseFallingIntoAThrowingDefaultInACatchESLintReadsAsNeverRun,
  caseFallingIntoAThrowingDefaultInASetter,
  caseFallingIntoAThrowingDefaultInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultInASwitchAfterALoopTestingOneInACase,
  caseFallingIntoAThrowingDefaultInASwitchAfterANeverCall,
  caseFallingIntoAThrowingDefaultInASwitchAfterANeverCallInACase,
  caseFallingIntoAThrowingDefaultInASwitchAfterAReturn,
  caseFallingIntoAThrowingDefaultInASwitchAfterAWhileTestingAParenthesisedTrue,
  caseFallingIntoAThrowingDefaultOnACall,
  caseFallingIntoAThrowingDefaultOnACommaExpressionInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalChainInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyOfThisInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAParenthesisedValueThatCanBeUndefinedInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAValueThatCanBeUndefined,
  caseFallingIntoAThrowingDefaultOnAGenericValue,
  caseFallingIntoAThrowingDefaultOnANonNullAssertionOnAParenthesisedNonNullAssertionOnAValueThatCanBeUndefinedInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnANonNullAssertionOnAValueThatCannotBeNullInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnANullishAssignment,
  caseFallingIntoAThrowingDefaultOnAPropertyOfAValueNarrowedBeforeTheSwitch,
  caseFallingIntoAThrowingDefaultOnAPropertyOfSuperInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnAPropertyOfThis,
  caseFallingIntoAThrowingDefaultOnAPropertyOfThisInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnATripleNonNullAssertionOnAValueThatCanBeUndefined,
  caseFallingIntoAThrowingDefaultOnAnElementOfATuple,
  caseFallingIntoAThrowingDefaultOnAnElementOfATupleInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnAnElementOfAnObjectInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnAnElementWithAConstKeyInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnAnElementWithALetKeyNeverReassignedInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnAnElementWithANamespaceConstKeyInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnAnElementWithAParameterKeyInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnAnElementWithATemplateKeyInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnAnElementWithAUniqueSymbolKeyInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnAnElementWithAnEnumMemberKeyInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultOnTheDiscriminantOfANonNullAssertedUnionInASwitchAfterALoopTestingOne,
  caseFallingIntoAThrowingDefaultPastACallToAnInferredNeverFunction,
  caseFallingIntoAThrowingDefaultPastACallWithNoReturnTypeWritten,
  caseFallingIntoAThrowingDefaultPastACallback,
  caseFallingIntoAThrowingDefaultPastACallbackLoopingOnOne,
  caseFallingIntoAThrowingDefaultPastACallbackWithATry,
  caseFallingIntoAThrowingDefaultPastADoWhileTestingAParenthesisedTrue,
  caseFallingIntoAThrowingDefaultPastAForTestingAParenthesisedTrue,
  caseFallingIntoAThrowingDefaultPastALoopTestingOne,
  caseFallingIntoAThrowingDefaultPastAMethodLoopingOnOne,
  caseFallingIntoAThrowingDefaultPastANeverCallInOneBranch,
  caseFallingIntoAThrowingDefaultPastAParenthesisedNeverCall,
  caseFallingIntoAThrowingDefaultPastAStaticBlockLoopingOnOne,
  caseFallingIntoAThrowingDefaultPastAWhileTestingAParenthesisedTrue,
  caseFallingIntoAThrowingDefaultPastAnIfWithoutAnElse,
  caseWithStatementsFallingIntoAThrowingDefault,
  neverBindingThenThrow,
  neverBindingThenThrowAtTheTopLevelOfAFile,
  neverBindingThenThrowInAClassStaticBlock,
  neverBindingThenThrowInASetter,
  neverDefaultAfterEveryCase,
  neverDefaultAfterEveryCaseOfABrandedUnion,
  neverDefaultOnACommaExpression,
  neverDefaultOnAConstHoldingACall,
  neverDefaultOnADiscriminant,
  neverDefaultOnADiscriminantReadAsAnElement,
  neverDefaultOnADiscriminantReadThroughAnOptionalChain,
  neverDefaultOnAGenericPropertyOfThis,
  neverDefaultOnAGenericValue,
  neverDefaultOnAGenericValueUsedAsAKey,
  neverDefaultOnANestedProperty,
  neverDefaultOnANonNullAssertionOnAValueThatCannotBeNull,
  neverDefaultOnAPropertyOfAUnionItDoesNotTellApart,
  neverDefaultOnAPropertyOfAUnionItPartlyTellsApart,
  neverDefaultOnAPropertyOfAnObject,
  neverDefaultOnAPropertyOfSuper,
  neverDefaultOnAnAssignment,
  neverDefaultOnAnElementOfAnObject,
  neverDefaultOnAnElementWithAConstKey,
  neverDefaultOnAnElementWithATemplateKey,
  neverDefaultOnAnElementWithAUniqueSymbolKey,
  neverDefaultOnAnOptionalPropertyAfterEveryCaseAndUndefined,
  neverDefaultOnTheDiscriminantOfAGenericUnion,
  neverDefaultOnTheDiscriminantOfANestedUnion,
  neverDefaultOnTheDiscriminantOfANonNullAssertedUnion,
  neverDefaultOnTheDiscriminantOfANonNullAssertedUnionThatCanBeUndefined,
  neverDefaultOnTheDiscriminantOfThis,
  noDefaultAfterEveryCase,
  returningDefaultAfterEveryCase,
  throwingDefaultAfterACaseBlockThatReturns,
  throwingDefaultAfterACaseOfAWholeType,
  throwingDefaultAfterACaseThatBreaksAfterALoopTestingOne,
  throwingDefaultAfterACaseThatCallsAFunctionReturningNever,
  throwingDefaultAfterACaseThatCallsANeverFunctionBeforeALoop,
  throwingDefaultAfterACaseThatCallsANeverFunctionBeforeThousandsOfCases,
  throwingDefaultAfterACaseThatCallsANeverFunctionDeclaredWithItsType,
  throwingDefaultAfterACaseThatCallsANeverMethod,
  throwingDefaultAfterACaseThatCallsAnImportedNeverFunction,
  throwingDefaultAfterACaseThatCallsAnOverloadReturningNever,
  throwingDefaultAfterACaseThatContinuesAfterALoopTestingOne,
  throwingDefaultAfterACaseThatLoopsForever,
  throwingDefaultAfterACaseThatLoopsForeverInADoWhile,
  throwingDefaultAfterACaseThatLoopsForeverInAFor,
  throwingDefaultAfterACaseThatReturnsAfterABlockHoldingALoopTestingOne,
  throwingDefaultAfterACaseThatReturnsAfterACallAndALoopTestingOne,
  throwingDefaultAfterACaseThatReturnsAfterALoopTestingOne,
  throwingDefaultAfterACaseThatReturnsAfterATryWhoseCatchCompletes,
  throwingDefaultAfterACaseThatReturnsFromANestedBlock,
  throwingDefaultAfterACaseThatReturnsFromATryWithAFinally,
  throwingDefaultAfterACaseThatReturnsPastACallbackLoopingOnOne,
  throwingDefaultAfterACaseThatReturnsPastACallbackWithATry,
  throwingDefaultAfterACaseThatThrows,
  throwingDefaultAfterACaseThatThrowsAfterALoopTestingOne,
  throwingDefaultAfterACaseWhoseIfAndElseBlocksBothReturn,
  throwingDefaultAfterACaseWhoseIfAndElseBothReturn,
  throwingDefaultAfterACaseWhoseIfAndElseReturnPastACallbackLoopingOnOne,
  throwingDefaultAfterACaseWhoseIfAndElseReturnPastACallbackWithATry,
  throwingDefaultAfterACaseWhoseIfAndElseReturnPastAFunctionDeclaredInIt,
  throwingDefaultAfterACaseWhoseIfAndElseReturnPastAMethodLoopingOnOne,
  throwingDefaultAfterACaseWhoseIfAndElseReturnPastAStaticBlockLoopingOnOne,
  throwingDefaultAfterACaseWhoseTryAndCatchBothReturn,
  throwingDefaultAfterCasesThatBreak,
  throwingDefaultAfterCasesThatContinue,
  throwingDefaultAfterEveryCase,
  throwingDefaultAfterEveryCaseInACatchESLintReadsAsNeverRun,
  throwingDefaultAfterEveryCaseInASwitchAfterALoopTestingOne,
  throwingDefaultAfterEveryCaseInASwitchAfterALoopThatRunsForever,
  throwingDefaultAfterEveryCaseInASwitchAfterANeverCall,
  throwingDefaultAfterEveryCaseInASwitchAfterANeverCallInABranch,
  throwingDefaultAfterEveryCaseInASwitchAfterANeverCallInACase,
  throwingDefaultAfterEveryCaseInASwitchAfterAReturn,
  throwingDefaultAfterEveryCaseOfABrandedUnion,
  throwingDefaultAfterEveryEnumMember,
  throwingDefaultAfterSomeCases,
  throwingDefaultAfterSomeCasesOfABrandedUnion,
  throwingDefaultAfterTrueAndFalse,
  throwingDefaultAtTheTopLevelOfAFile,
  throwingDefaultBeforeEveryCase,
  throwingDefaultInABlock,
  throwingDefaultInAClassStaticBlock,
  throwingDefaultInAFunctionInAClassStaticBlock,
  throwingDefaultInASetter,
  throwingDefaultOnACall,
  throwingDefaultOnACallAtTheTopLevelOfAFile,
  throwingDefaultOnACallInASwitchAfterAReturn,
  throwingDefaultOnACast,
  throwingDefaultOnACommaExpression,
  throwingDefaultOnACommaExpressionInASwitchAfterAReturn,
  throwingDefaultOnACommaOfThreeOperands,
  throwingDefaultOnACommaOfThreeOperandsInASwitchAfterAReturn,
  throwingDefaultOnADiscriminant,
  throwingDefaultOnADiscriminantReadAsAnElement,
  throwingDefaultOnADiscriminantReadThroughAnOptionalChain,
  throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalChain,
  throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalChainInASwitchAfterAReturn,
  throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalProperty,
  throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyInASwitchAfterAReturn,
  throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyOfThis,
  throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyOfThisInASwitchAfterAReturn,
  throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedValueThatCanBeUndefined,
  throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedValueThatCanBeUndefinedInASwitchAfterAReturn,
  throwingDefaultOnADoubleNonNullAssertionOnAValueThatCanBeUndefined,
  throwingDefaultOnAGenericPropertyOfThis,
  throwingDefaultOnAGenericValue,
  throwingDefaultOnAGenericValueUsedAsAKey,
  throwingDefaultOnALogicalAndAssignment,
  throwingDefaultOnALogicalOrAssignment,
  throwingDefaultOnANestedProperty,
  throwingDefaultOnANonNullAssertionOnAParenthesisedNonNullAssertionOnAValueThatCanBeUndefined,
  throwingDefaultOnANonNullAssertionOnAParenthesisedNonNullAssertionOnAValueThatCanBeUndefinedInASwitchAfterAReturn,
  throwingDefaultOnANonNullAssertionOnAParenthesisedOptionalChain,
  throwingDefaultOnANonNullAssertionOnAParenthesisedOptionalChainInASwitchAfterAReturn,
  throwingDefaultOnANonNullAssertionOnAValueThatCanBeUndefined,
  throwingDefaultOnANonNullAssertionOnAValueThatCannotBeNull,
  throwingDefaultOnANonNullAssertionOnAValueThatCannotBeNullInASwitchAfterAReturn,
  throwingDefaultOnANullishAssignment,
  throwingDefaultOnANullishCoalescing,
  throwingDefaultOnAPropertyOfACommaExpression,
  throwingDefaultOnAPropertyOfACommaExpressionInASwitchAfterAReturn,
  throwingDefaultOnAPropertyOfAUnionItDoesNotTellApart,
  throwingDefaultOnAPropertyOfAUnionItPartlyTellsApart,
  throwingDefaultOnAPropertyOfAValueNarrowedBeforeTheSwitch,
  throwingDefaultOnAPropertyOfAnObject,
  throwingDefaultOnAPropertyOfSuper,
  throwingDefaultOnAPropertyOfSuperInASwitchAfterAReturn,
  throwingDefaultOnAPropertyOfThis,
  throwingDefaultOnAString,
  throwingDefaultOnATripleNonNullAssertionOnAValueThatCanBeUndefined,
  throwingDefaultOnAnAssignment,
  throwingDefaultOnAnElementOfARecordReadWithAStringKey,
  throwingDefaultOnAnElementOfARecordReadWithAStringKeyInASwitchAfterAReturn,
  throwingDefaultOnAnElementOfATuple,
  throwingDefaultOnAnElementOfAnObject,
  throwingDefaultOnAnElementWithAConstKey,
  throwingDefaultOnAnElementWithAConstKeyInASwitchAfterAReturn,
  throwingDefaultOnAnElementWithALetKeyNeverReassigned,
  throwingDefaultOnAnElementWithALetKeyNeverReassignedInASwitchAfterAReturn,
  throwingDefaultOnAnElementWithALetKeyReassigned,
  throwingDefaultOnAnElementWithANamespaceConstKey,
  throwingDefaultOnAnElementWithANamespaceConstKeyInASwitchAfterAReturn,
  throwingDefaultOnAnElementWithAParameterKey,
  throwingDefaultOnAnElementWithAParameterKeyInASwitchAfterAReturn,
  throwingDefaultOnAnElementWithATemplateKey,
  throwingDefaultOnAnElementWithATemplateKeyInASwitchAfterAReturn,
  throwingDefaultOnAnElementWithAUniqueSymbolKey,
  throwingDefaultOnAnElementWithAUniqueSymbolKeyInASwitchAfterAReturn,
  throwingDefaultOnAnElementWithAnAliasedConstKey,
  throwingDefaultOnAnElementWithAnAliasedConstKeyInASwitchAfterAReturn,
  throwingDefaultOnAnElementWithAnEnumMemberKey,
  throwingDefaultOnAnElementWithAnEnumMemberKeyInASwitchAfterAReturn,
  throwingDefaultOnAnOptionalPropertyAfterEveryCaseAndUndefined,
  throwingDefaultOnAnOptionalPropertyAfterEveryCaseButUndefined,
  throwingDefaultOnTheDiscriminantOfAGenericUnion,
  throwingDefaultOnTheDiscriminantOfANestedUnion,
  throwingDefaultOnTheDiscriminantOfANestedUnionReadThroughAnOptionalChain,
  throwingDefaultOnTheDiscriminantOfANonNullAssertedUnion,
  throwingDefaultOnTheDiscriminantOfANonNullAssertedUnionInASwitchAfterAReturn,
  throwingDefaultOnTheDiscriminantOfANonNullAssertedUnionThatCanBeUndefined,
  throwingDefaultOnTheDiscriminantOfThis,
  throwingDefaultOnTheTypeOfAUnion,
  throwingDefaultOnTheTypeOfAUnionInASwitchAfterAReturn,
  throwingDefaultOnTheTypeOfAnUnknownValue,
  throwingDefaultOpeningWithAClassWhoseHeritageAssignsTheValue,
  throwingDefaultOpeningWithAConstWhoseInitializerAssignsTheValue,
  throwingDefaultOpeningWithADebuggerStatement,
  throwingDefaultOpeningWithADebuggerStatementInASwitchAfterAReturn,
  throwingDefaultOpeningWithAFunctionDeclaration,
  throwingDefaultOpeningWithALetWhoseInitializerAssignsTheValue,
  throwingDefaultOpeningWithAnEmptyStatement,
  throwingDefaultOpeningWithAnEnumWhoseInitializerAssignsTheValue,
} from '../__tests__/cases/no-throwing-default-in-exhaustive-switch.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester, houseTypedRuleTester } from '../__tests__/house-rule-tester.ts'
import { repoOwnPlugin } from '../repo-own-plugin.ts'

const rule = repoOwnPlugin.rules['no-throwing-default-in-exhaustive-switch']

// No invalid case declares `output` or `suggestions`, so the tester fails any fix the rule offers.
houseTypedRuleTester.run('no-throwing-default-in-exhaustive-switch', rule, {
  valid: [
    buildValidCase('stays silent on the never default', neverDefaultAfterEveryCase),
    buildValidCase('stays silent on a default that binds the value to never before it throws', neverBindingThenThrow),
    buildValidCase('stays silent on the never default binding a discriminated union, on a switch on its discriminant', neverDefaultOnADiscriminant),
    buildValidCase('stays silent on the never default binding the property, on a switch on a property of an object', neverDefaultOnAPropertyOfAnObject),
    buildValidCase(
      'stays silent on the never default binding the property, on a switch on a property of a union it does not tell apart',
      neverDefaultOnAPropertyOfAUnionItDoesNotTellApart,
    ),
    buildValidCase('stays silent on the never default binding the union, on a switch on a property that partly tells it apart', neverDefaultOnAPropertyOfAUnionItPartlyTellsApart),
    buildValidCase('stays silent on the never default binding the nested property, on a switch on a nested property', neverDefaultOnANestedProperty),
    buildValidCase('stays silent on the never default binding the nested union, on a switch on its discriminant', neverDefaultOnTheDiscriminantOfANestedUnion),
    buildValidCase('stays silent on the never default binding the element, on a switch on an element of an object', neverDefaultOnAnElementOfAnObject),
    buildValidCase('stays silent on the never default binding the union, on a switch on its discriminant read as an element', neverDefaultOnADiscriminantReadAsAnElement),
    buildValidCase(
      'stays silent on the never default binding the union, on a switch on its discriminant read through an optional chain',
      neverDefaultOnADiscriminantReadThroughAnOptionalChain,
    ),
    buildValidCase('stays silent on the never default binding the name assigned, on a switch on an assignment', neverDefaultOnAnAssignment),
    buildValidCase('stays silent on a throwing default after some of the cases, which it handles', throwingDefaultAfterSomeCases),
    buildValidCase('stays silent on a throwing default in a switch over a string, which has no list of cases', throwingDefaultOnAString),
    buildValidCase('stays silent on a throwing default where a case names a whole type rather than one value', throwingDefaultAfterACaseOfAWholeType),
    buildValidCase('stays silent on a switch over every case with no default', noDefaultAfterEveryCase),
    buildValidCase('stays silent on a default after every case that returns', returningDefaultAfterEveryCase),
    buildValidCase('stays silent on a throwing default a case falls into', caseFallingIntoAThrowingDefault),
    buildValidCase('stays silent on a throwing default a case falls into after running its own statements', caseWithStatementsFallingIntoAThrowingDefault),
    buildValidCase('stays silent on a throwing default a case falls into from the end of its block', caseBlockFallingIntoAThrowingDefault),
    buildValidCase('stays silent on a throwing default a case falls into past an if with no else', caseFallingIntoAThrowingDefaultPastAnIfWithoutAnElse),
    buildValidCase('stays silent on a throwing default a case falls into from a catch that completes', caseFallingIntoAThrowingDefaultFromACatch),
    buildValidCase(
      'stays silent on a throwing default a case falls into past a call TypeScript does not read as leaving, to a never function with an inferred name',
      caseFallingIntoAThrowingDefaultPastACallToAnInferredNeverFunction,
    ),
    buildValidCase('stays silent on a throwing default a case falls into past a call to a function with no return type written', caseFallingIntoAThrowingDefaultPastACallWithNoReturnTypeWritten),
    buildValidCase('stays silent on a throwing default a case falls into where only one branch calls a never function', caseFallingIntoAThrowingDefaultPastANeverCallInOneBranch),
    buildValidCase('stays silent on a throwing default a case falls into past a loop testing 1, which TypeScript does not read as endless', caseFallingIntoAThrowingDefaultPastALoopTestingOne),
    buildValidCase('stays silent on a throwing default a case falls into after handing a callback to a call', caseFallingIntoAThrowingDefaultPastACallback),
    buildValidCase(
      'stays silent on a throwing default a case falls into past a parenthesised call to a never function, which TypeScript does not read as leaving',
      caseFallingIntoAThrowingDefaultPastAParenthesisedNeverCall,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into past a while testing a parenthesised true, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultPastAWhileTestingAParenthesisedTrue,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into past a for testing a parenthesised true, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultPastAForTestingAParenthesisedTrue,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into past a do-while testing a parenthesised true, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultPastADoWhileTestingAParenthesisedTrue,
    ),
    buildValidCase('stays silent on a throwing default a case falls into after defining a callback that loops testing 1', caseFallingIntoAThrowingDefaultPastACallbackLoopingOnOne),
    buildValidCase('stays silent on a throwing default a case falls into after calling a callback with its own try', caseFallingIntoAThrowingDefaultPastACallbackWithATry),
    buildValidCase('stays silent on a throwing default the last of thousands of cases falls into', caseFallingIntoAThrowingDefaultAfterThousandsOfCases),
    buildValidCase('stays silent on a throwing default a case falls into after defining a method that loops testing 1', caseFallingIntoAThrowingDefaultPastAMethodLoopingOnOne),
    buildValidCase('stays silent on a throwing default a case falls into after defining a class whose static block loops testing 1', caseFallingIntoAThrowingDefaultPastAStaticBlockLoopingOnOne),
    buildValidCase(
      'stays silent on a throwing default a case falls into in a catch ESLint reads as never run, which TypeScript reads as run',
      caseFallingIntoAThrowingDefaultInACatchESLintReadsAsNeverRun,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultInASwitchAfterALoopTestingOne,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into in a switch after a while testing a parenthesised true, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultInASwitchAfterAWhileTestingAParenthesisedTrue,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into in a switch after a loop testing 1 in a case, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultInASwitchAfterALoopTestingOneInACase,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into in a switch after a return, where TypeScript takes the value at its declared type',
      caseFallingIntoAThrowingDefaultInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into in a switch after a never call in a case, where TypeScript takes the value at its declared type',
      caseFallingIntoAThrowingDefaultInASwitchAfterANeverCallInACase,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into in a switch after a never call outside any case, where TypeScript takes the value at its declared type',
      caseFallingIntoAThrowingDefaultInASwitchAfterANeverCall,
    ),
    buildValidCase(
      'stays silent on a throwing default after every case in a switch after a return, where TypeScript takes the value at its declared type',
      throwingDefaultAfterEveryCaseInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default after every case in a switch after a loop testing true, where TypeScript takes the value at its declared type',
      throwingDefaultAfterEveryCaseInASwitchAfterALoopThatRunsForever,
    ),
    buildValidCase(
      'stays silent on a throwing default after every case in a switch after a never call in a case, where TypeScript takes the value at its declared type',
      throwingDefaultAfterEveryCaseInASwitchAfterANeverCallInACase,
    ),
    buildValidCase(
      'stays silent on a throwing default after every case in a switch after a never call outside any case, where TypeScript takes the value at its declared type',
      throwingDefaultAfterEveryCaseInASwitchAfterANeverCall,
    ),
    buildValidCase(
      'stays silent on a throwing default after every case in a switch after a never call in a branch, where TypeScript takes the value at its declared type',
      throwingDefaultAfterEveryCaseInASwitchAfterANeverCallInABranch,
    ),
    buildValidCase('stays silent on the never default binding the element, on a switch on an element read with a const key', neverDefaultOnAnElementWithAConstKey),
    buildValidCase(
      'stays silent on a throwing default on an element read with a const key in a switch after a return, where TypeScript takes the element at its declared type',
      throwingDefaultOnAnElementWithAConstKeyInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on an element read with a const key in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnAnElementWithAConstKeyInASwitchAfterALoopTestingOne,
    ),
    buildValidCase('stays silent on the never default binding the element, on a switch on an element read with a template key', neverDefaultOnAnElementWithATemplateKey),
    buildValidCase(
      'stays silent on a throwing default on an element read with a template key in a switch after a return, where TypeScript takes the element at its declared type',
      throwingDefaultOnAnElementWithATemplateKeyInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on an element read with a template key in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnAnElementWithATemplateKeyInASwitchAfterALoopTestingOne,
    ),
    buildValidCase('stays silent on the never default binding the element, on a switch on an element read with a unique symbol key', neverDefaultOnAnElementWithAUniqueSymbolKey),
    buildValidCase(
      'stays silent on a throwing default on an element read with a unique symbol key in a switch after a return, where TypeScript takes the element at its declared type',
      throwingDefaultOnAnElementWithAUniqueSymbolKeyInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on an element read with a unique symbol key in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnAnElementWithAUniqueSymbolKeyInASwitchAfterALoopTestingOne,
    ),
    buildValidCase('stays silent on the never default binding the property, on a switch on a property of super', neverDefaultOnAPropertyOfSuper),
    buildValidCase(
      'stays silent on a throwing default on a property of super in a switch after a return, where TypeScript takes the property at its declared type',
      throwingDefaultOnAPropertyOfSuperInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on a property of super in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnAPropertyOfSuperInASwitchAfterALoopTestingOne,
    ),
    buildValidCase(
      'stays silent on the never default binding the value, on a switch on a non-null assertion on a value that cannot be null',
      neverDefaultOnANonNullAssertionOnAValueThatCannotBeNull,
    ),
    buildValidCase(
      'stays silent on a throwing default on a non-null assertion on a value that cannot be null in a switch after a return, where TypeScript takes the value at its declared type',
      throwingDefaultOnANonNullAssertionOnAValueThatCannotBeNullInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on a non-null assertion on a value that cannot be null in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnANonNullAssertionOnAValueThatCannotBeNullInASwitchAfterALoopTestingOne,
    ),
    buildValidCase(
      'stays silent on the never default binding the union, on a switch on the discriminant of a union under a non-null assertion',
      neverDefaultOnTheDiscriminantOfANonNullAssertedUnion,
    ),
    buildValidCase(
      'stays silent on the never default binding the union, on a switch on the discriminant of a union that can be undefined under a non-null assertion',
      neverDefaultOnTheDiscriminantOfANonNullAssertedUnionThatCanBeUndefined,
    ),
    buildValidCase(
      'stays silent on a throwing default on the discriminant of a union under a non-null assertion in a switch after a return, where TypeScript takes the union at its declared type',
      throwingDefaultOnTheDiscriminantOfANonNullAssertedUnionInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on the discriminant of a union under a non-null assertion in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnTheDiscriminantOfANonNullAssertedUnionInASwitchAfterALoopTestingOne,
    ),
    buildValidCase("stays silent on the never default binding the comma's last operand, on a switch on a comma", neverDefaultOnACommaExpression),
    buildValidCase(
      'stays silent on a throwing default on a comma in a switch after a return, where TypeScript takes its last operand at its declared type',
      throwingDefaultOnACommaExpressionInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on a comma in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnACommaExpressionInASwitchAfterALoopTestingOne,
    ),
    buildValidCase('stays silent on the never default binding the value, on a switch on a value typed by a type parameter', neverDefaultOnAGenericValue),
    buildValidCase('stays silent on a throwing default a case falls into, on a switch on a value typed by a type parameter', caseFallingIntoAThrowingDefaultOnAGenericValue),
    buildValidCase(
      'stays silent on the never default binding the value, on a switch on a value typed by a type parameter it also keys a record by',
      neverDefaultOnAGenericValueUsedAsAKey,
    ),
    buildValidCase('stays silent on the never default binding the property, on a switch on a property of this typed by a type parameter', neverDefaultOnAGenericPropertyOfThis),
    buildValidCase(
      'stays silent on the never default binding the union, on a switch on the discriminant of a union typed by a type parameter',
      neverDefaultOnTheDiscriminantOfAGenericUnion,
    ),
    buildValidCase('stays silent on the never default after every case of a branded union', neverDefaultAfterEveryCaseOfABrandedUnion),
    buildValidCase('stays silent on a throwing default after some of the cases of a branded union, which it handles', throwingDefaultAfterSomeCasesOfABrandedUnion),
    buildValidCase(
      'stays silent on the never default binding the property, on a switch on an optional property after every case and undefined',
      neverDefaultOnAnOptionalPropertyAfterEveryCaseAndUndefined,
    ),
    buildValidCase(
      'stays silent on a throwing default on an optional property after every case but undefined, which it handles',
      throwingDefaultOnAnOptionalPropertyAfterEveryCaseButUndefined,
    ),
    buildValidCase(
      'stays silent on a throwing default on the discriminant of a nested union read through an optional chain, where no never default compiles',
      throwingDefaultOnTheDiscriminantOfANestedUnionReadThroughAnOptionalChain,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on an element of an object in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnAnElementOfAnObjectInASwitchAfterALoopTestingOne,
    ),
    buildValidCase('stays silent on a throwing default a case falls into, on an element of a tuple', caseFallingIntoAThrowingDefaultOnAnElementOfATuple),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on an element of a tuple in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnAnElementOfATupleInASwitchAfterALoopTestingOne,
    ),
    buildValidCase('stays silent on a throwing default a case falls into, on a property of this', caseFallingIntoAThrowingDefaultOnAPropertyOfThis),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on a property of this in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnAPropertyOfThisInASwitchAfterALoopTestingOne,
    ),
    buildValidCase('stays silent on the never default binding this, on a switch on the discriminant of this', neverDefaultOnTheDiscriminantOfThis),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on a property of a value narrowed before the switch',
      caseFallingIntoAThrowingDefaultOnAPropertyOfAValueNarrowedBeforeTheSwitch,
    ),
    buildValidCase('stays silent on a throwing default a case falls into, on a nullish assignment', caseFallingIntoAThrowingDefaultOnANullishAssignment),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on a double non-null assertion on a value that can be undefined',
      caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAValueThatCanBeUndefined,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on a triple non-null assertion on a value that can be undefined',
      caseFallingIntoAThrowingDefaultOnATripleNonNullAssertionOnAValueThatCanBeUndefined,
    ),
    buildValidCase(
      'stays silent on a throwing default opening with a debugger statement in a switch after a return, where TypeScript takes the value at its declared type',
      throwingDefaultOpeningWithADebuggerStatementInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default on a comma of three operands in a switch after a return, where TypeScript takes its last operand at its declared type',
      throwingDefaultOnACommaOfThreeOperandsInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default on an element read with an aliased const key in a switch after a return, where TypeScript takes the element at its declared type',
      throwingDefaultOnAnElementWithAnAliasedConstKeyInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default on an element read with an enum member key in a switch after a return, where TypeScript takes the element at its declared type',
      throwingDefaultOnAnElementWithAnEnumMemberKeyInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on an element read with an enum member key in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnAnElementWithAnEnumMemberKeyInASwitchAfterALoopTestingOne,
    ),
    buildValidCase(
      "stays silent on a throwing default on an element read with a namespace's const key in a switch after a return, where TypeScript takes the element at its declared type",
      throwingDefaultOnAnElementWithANamespaceConstKeyInASwitchAfterAReturn,
    ),
    buildValidCase(
      "stays silent on a throwing default a case falls into, on an element read with a namespace's const key in a switch after a loop testing 1, which TypeScript does not read as endless",
      caseFallingIntoAThrowingDefaultOnAnElementWithANamespaceConstKeyInASwitchAfterALoopTestingOne,
    ),
    buildValidCase(
      'stays silent on a throwing default on an element read with a parameter key in a switch after a return, where TypeScript takes the element at its declared type',
      throwingDefaultOnAnElementWithAParameterKeyInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on an element read with a parameter key in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnAnElementWithAParameterKeyInASwitchAfterALoopTestingOne,
    ),
    buildValidCase(
      'stays silent on a throwing default on an element read with a let key never reassigned in a switch after a return, where TypeScript takes the element at its declared type',
      throwingDefaultOnAnElementWithALetKeyNeverReassignedInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on an element read with a let key never reassigned in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnAnElementWithALetKeyNeverReassignedInASwitchAfterALoopTestingOne,
    ),
    buildValidCase(
      'stays silent on a throwing default on an element of a record read with a string key in a switch after a return, where TypeScript takes the element at its declared type',
      throwingDefaultOnAnElementOfARecordReadWithAStringKeyInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default on a property of a comma in a switch after a return, where TypeScript takes the property at its declared type',
      throwingDefaultOnAPropertyOfACommaExpressionInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default on a non-null assertion on a parenthesised optional chain in a switch after a return, where TypeScript takes the value at its declared type',
      throwingDefaultOnANonNullAssertionOnAParenthesisedOptionalChainInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default on a double non-null assertion on a parenthesised value that can be undefined in a switch after a return, where TypeScript takes the value at its declared type',
      throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedValueThatCanBeUndefinedInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on a double non-null assertion on a parenthesised value that can be undefined in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAParenthesisedValueThatCanBeUndefinedInASwitchAfterALoopTestingOne,
    ),
    buildValidCase(
      'stays silent on a throwing default on a non-null assertion on a parenthesised non-null assertion in a switch after a return, where TypeScript takes the value at its declared type',
      throwingDefaultOnANonNullAssertionOnAParenthesisedNonNullAssertionOnAValueThatCanBeUndefinedInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on a non-null assertion on a parenthesised non-null assertion in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnANonNullAssertionOnAParenthesisedNonNullAssertionOnAValueThatCanBeUndefinedInASwitchAfterALoopTestingOne,
    ),
    buildValidCase(
      'stays silent on a throwing default on a double non-null assertion on a parenthesised optional property in a switch after a return, where TypeScript takes the property at its declared type',
      throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on a double non-null assertion on a parenthesised optional property in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyInASwitchAfterALoopTestingOne,
    ),
    buildValidCase(
      'stays silent on a throwing default on a double non-null assertion on a parenthesised optional property of this in a switch after a return, where TypeScript takes the property at its declared type',
      throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyOfThisInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on a double non-null assertion on a parenthesised optional property of this in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyOfThisInASwitchAfterALoopTestingOne,
    ),
    buildValidCase(
      'stays silent on a throwing default on a double non-null assertion on a parenthesised optional chain in a switch after a return, where TypeScript takes the value at its declared type',
      throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalChainInASwitchAfterAReturn,
    ),
    buildValidCase(
      'stays silent on a throwing default a case falls into, on a double non-null assertion on a parenthesised optional chain in a switch after a loop testing 1, which TypeScript does not read as endless',
      caseFallingIntoAThrowingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalChainInASwitchAfterALoopTestingOne,
    ),
    buildValidCase(
      'stays silent on a throwing default on the type of a union in a switch after a return, where TypeScript takes the value at its declared type',
      throwingDefaultOnTheTypeOfAUnionInASwitchAfterAReturn,
    ),
    buildValidCase('stays silent on the never default binding a const holding a call, on a switch on that const', neverDefaultOnAConstHoldingACall),
    buildValidCase('stays silent on a throwing default a case falls into, on a call, where a never default on a const holding it would not compile either', caseFallingIntoAThrowingDefaultOnACall),
    buildValidCase(
      'stays silent on a throwing default on a call in a switch after a return, where a never default on a const holding it would not compile either',
      throwingDefaultOnACallInASwitchAfterAReturn,
    ),
    buildValidCase("stays silent on a default at a file's top level that binds the value to never before it throws", neverBindingThenThrowAtTheTopLevelOfAFile),
    buildValidCase('stays silent on a default in a class static block that binds the value to never before it throws', neverBindingThenThrowInAClassStaticBlock),
    buildValidCase('stays silent on a default in a setter that binds the value to never before it throws', neverBindingThenThrowInASetter),
    buildValidCase('stays silent on a throwing default a case falls into, in a setter', caseFallingIntoAThrowingDefaultInASetter),
  ],
  invalid: [
    buildInvalidCase('reports a throwing default after every case of a union of strings', throwingDefaultAfterEveryCase, {
      errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a default block that ends in a throw', throwingDefaultInABlock, {
      errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase(
      'reports a throwing default after every case of a discriminated union, naming the union to bind, which TypeScript narrows to never',
      throwingDefaultOnADiscriminant,
      { errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'shape' } }] },
    ),
    buildInvalidCase('reports a throwing default on a property of an object, naming the property to bind', throwingDefaultOnAPropertyOfAnObject, {
      errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'config.engine' } }],
    }),
    buildInvalidCase(
      'reports a throwing default on a property of a union it does not tell apart, naming the property to bind',
      throwingDefaultOnAPropertyOfAUnionItDoesNotTellApart,
      { errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'box.size' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default on a property that partly tells a union apart, naming the union to bind',
      throwingDefaultOnAPropertyOfAUnionItPartlyTellsApart,
      { errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'box' } }] },
    ),
    buildInvalidCase('reports a throwing default on a nested property, naming the nested property to bind', throwingDefaultOnANestedProperty, {
      errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'job.config.engine' } }],
    }),
    buildInvalidCase(
      'reports a throwing default on the discriminant of a nested union, naming the nested union to bind',
      throwingDefaultOnTheDiscriminantOfANestedUnion,
      { errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'drawing.shape' } }] },
    ),
    buildInvalidCase('reports a throwing default on an element of an object, naming the element to bind', throwingDefaultOnAnElementOfAnObject, {
      errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: "config['engine']" } }],
    }),
    // Both the union and the element compile in a never default here, so the cross-check against TypeScript, which
    // compiles the one the message names, checks the message.
    buildInvalidCase('reports a throwing default on a discriminant read as an element', throwingDefaultOnADiscriminantReadAsAnElement, {
      errors: [{ messageId: 'throwingDefault', line: 9 }],
    }),
    buildInvalidCase(
      'reports a throwing default on a discriminant read through an optional chain, naming the union to bind',
      throwingDefaultOnADiscriminantReadThroughAnOptionalChain,
      { errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'shape' } }] },
    ),
    buildInvalidCase('reports a throwing default on an assignment, naming the name assigned to bind', throwingDefaultOnAnAssignment, {
      errors: [{ messageId: 'throwingDefault', line: 12, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default after every member of an enum', throwingDefaultAfterEveryEnumMember, {
      errors: [{ messageId: 'throwingDefault', line: 12, data: { discriminant: 'severity' } }],
    }),
    buildInvalidCase('reports a throwing default after true and false', throwingDefaultAfterTrueAndFalse, {
      errors: [{ messageId: 'throwingDefault', line: 7, data: { discriminant: 'on' } }],
    }),
    buildInvalidCase('reports a throwing default after cases that run statements and break, so none falls into it', throwingDefaultAfterCasesThatBreak, {
      errors: [{ messageId: 'throwingDefault', line: 13, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default after a case whose block ends in a return, so it does not fall into it', throwingDefaultAfterACaseBlockThatReturns, {
      errors: [{ messageId: 'throwingDefault', line: 13, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default after a case that ends in its own throw, so it does not fall into it', throwingDefaultAfterACaseThatThrows, {
      errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default after cases that continue a loop, so none falls into it', throwingDefaultAfterCasesThatContinue, {
      errors: [{ messageId: 'throwingDefault', line: 14, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default written before every case, which no case falls into', throwingDefaultBeforeEveryCase, {
      errors: [{ messageId: 'throwingDefault', line: 5, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default after a case whose if and else both return, so it does not fall into it', throwingDefaultAfterACaseWhoseIfAndElseBothReturn, {
      errors: [{ messageId: 'throwingDefault', line: 10, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase(
      'reports a throwing default after a case whose if and else blocks both return, so it does not fall into it',
      throwingDefaultAfterACaseWhoseIfAndElseBlocksBothReturn,
      { errors: [{ messageId: 'throwingDefault', line: 13, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case that returns from a try whose finally completes, so it does not fall into it',
      throwingDefaultAfterACaseThatReturnsFromATryWithAFinally,
      { errors: [{ messageId: 'throwingDefault', line: 15, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case that calls a function declared to return never, so it does not fall into it',
      throwingDefaultAfterACaseThatCallsAFunctionReturningNever,
      { errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase('reports a throwing default after a case that returns from a nested block, so it does not fall into it', throwingDefaultAfterACaseThatReturnsFromANestedBlock, {
      errors: [{ messageId: 'throwingDefault', line: 13, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase(
      'reports a throwing default after a case that calls a never function held in a const declared with its type',
      throwingDefaultAfterACaseThatCallsANeverFunctionDeclaredWithItsType,
      { errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase('reports a throwing default after a case that calls a never method of an object declared with its type', throwingDefaultAfterACaseThatCallsANeverMethod, {
      errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default after a case that calls a never function through an import', throwingDefaultAfterACaseThatCallsAnImportedNeverFunction, {
      errors: [{ messageId: 'throwingDefault', line: 14, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default after a case whose call resolves to an overload returning never', throwingDefaultAfterACaseThatCallsAnOverloadReturningNever, {
      errors: [{ messageId: 'throwingDefault', line: 12, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default after a case that calls a never function before a loop', throwingDefaultAfterACaseThatCallsANeverFunctionBeforeALoop, {
      errors: [{ messageId: 'throwingDefault', line: 13, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default after a case that loops while true', throwingDefaultAfterACaseThatLoopsForever, {
      errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default after a case whose try and catch both return', throwingDefaultAfterACaseWhoseTryAndCatchBothReturn, {
      errors: [{ messageId: 'throwingDefault', line: 15, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default after a case that loops in a for testing true', throwingDefaultAfterACaseThatLoopsForeverInAFor, {
      errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default after a case that loops in a do-while testing true', throwingDefaultAfterACaseThatLoopsForeverInADoWhile, {
      errors: [{ messageId: 'throwingDefault', line: 13, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase(
      'reports a throwing default after a case that returns after a try whose catch completes, so it does not fall into it',
      throwingDefaultAfterACaseThatReturnsAfterATryWhoseCatchCompletes,
      { errors: [{ messageId: 'throwingDefault', line: 16, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case that returns after a loop testing 1 that breaks, so it does not fall into it',
      throwingDefaultAfterACaseThatReturnsAfterALoopTestingOne,
      { errors: [{ messageId: 'throwingDefault', line: 15, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case that returns past a callback looping testing 1, so it does not fall into it',
      throwingDefaultAfterACaseThatReturnsPastACallbackLoopingOnOne,
      { errors: [{ messageId: 'throwingDefault', line: 16, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case that returns past a callback with its own try, so it does not fall into it',
      throwingDefaultAfterACaseThatReturnsPastACallbackWithATry,
      { errors: [{ messageId: 'throwingDefault', line: 17, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case that calls a never function before a switch of thousands of cases',
      throwingDefaultAfterACaseThatCallsANeverFunctionBeforeThousandsOfCases,
      { errors: [{ messageId: 'throwingDefault', line: 12, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case that throws after a loop testing 1 that breaks, so it does not fall into it',
      throwingDefaultAfterACaseThatThrowsAfterALoopTestingOne,
      { errors: [{ messageId: 'throwingDefault', line: 15, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case that breaks after a loop testing 1 that breaks, so it does not fall into it',
      throwingDefaultAfterACaseThatBreaksAfterALoopTestingOne,
      { errors: [{ messageId: 'throwingDefault', line: 16, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case that continues after a loop testing 1 that breaks, so it does not fall into it',
      throwingDefaultAfterACaseThatContinuesAfterALoopTestingOne,
      { errors: [{ messageId: 'throwingDefault', line: 17, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case whose if and else return past a callback looping testing 1, so it does not fall into it',
      throwingDefaultAfterACaseWhoseIfAndElseReturnPastACallbackLoopingOnOne,
      { errors: [{ messageId: 'throwingDefault', line: 17, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case whose if and else return past a callback with its own try, so it does not fall into it',
      throwingDefaultAfterACaseWhoseIfAndElseReturnPastACallbackWithATry,
      { errors: [{ messageId: 'throwingDefault', line: 18, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case of three statements that returns after a loop testing 1, so it does not fall into it',
      throwingDefaultAfterACaseThatReturnsAfterACallAndALoopTestingOne,
      { errors: [{ messageId: 'throwingDefault', line: 16, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case whose if and else return past a function it declares that loops testing 1, so it does not fall into it',
      throwingDefaultAfterACaseWhoseIfAndElseReturnPastAFunctionDeclaredInIt,
      { errors: [{ messageId: 'throwingDefault', line: 16, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case that returns after a block holding a loop testing 1 that breaks, so it does not fall into it',
      throwingDefaultAfterACaseThatReturnsAfterABlockHoldingALoopTestingOne,
      { errors: [{ messageId: 'throwingDefault', line: 14, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case whose if and else return past a method looping testing 1, so it does not fall into it',
      throwingDefaultAfterACaseWhoseIfAndElseReturnPastAMethodLoopingOnOne,
      { errors: [{ messageId: 'throwingDefault', line: 18, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after a case whose if and else return past a static block looping testing 1, so it does not fall into it',
      throwingDefaultAfterACaseWhoseIfAndElseReturnPastAStaticBlockLoopingOnOne,
      { errors: [{ messageId: 'throwingDefault', line: 18, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after every case in a catch ESLint reads as never run, which TypeScript reads as run',
      throwingDefaultAfterEveryCaseInACatchESLintReadsAsNeverRun,
      { errors: [{ messageId: 'throwingDefault', line: 12, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default after every case in a switch after a loop testing 1, which TypeScript does not read as endless',
      throwingDefaultAfterEveryCaseInASwitchAfterALoopTestingOne,
      { errors: [{ messageId: 'throwingDefault', line: 12, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase('reports a throwing default on an element read with a const key, naming the element to bind', throwingDefaultOnAnElementWithAConstKey, {
      errors: [{ messageId: 'throwingDefault', line: 13, data: { discriminant: 'config[KEY]' } }],
    }),
    buildInvalidCase('reports a throwing default on an element read with a template key, naming the element to bind', throwingDefaultOnAnElementWithATemplateKey, {
      errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'config[`engine`]' } }],
    }),
    buildInvalidCase('reports a throwing default on an element read with a unique symbol key, naming the element to bind', throwingDefaultOnAnElementWithAUniqueSymbolKey, {
      errors: [{ messageId: 'throwingDefault', line: 13, data: { discriminant: 'config[ENGINE]' } }],
    }),
    buildInvalidCase('reports a throwing default on a property of super, naming the property to bind', throwingDefaultOnAPropertyOfSuper, {
      errors: [{ messageId: 'throwingDefault', line: 16, data: { discriminant: 'super.engine' } }],
    }),
    // Two never defaults compile in each of these four: the value or union under `!`, with or without it; the comma's
    // last operand, or the whole comma in its parentheses. The cross-check against TypeScript checks the one the
    // message names.
    buildInvalidCase('reports a throwing default on a non-null assertion on a value that cannot be null', throwingDefaultOnANonNullAssertionOnAValueThatCannotBeNull, {
      errors: [{ messageId: 'throwingDefault', line: 9 }],
    }),
    buildInvalidCase('reports a throwing default on the discriminant of a union under a non-null assertion', throwingDefaultOnTheDiscriminantOfANonNullAssertedUnion, {
      errors: [{ messageId: 'throwingDefault', line: 9 }],
    }),
    buildInvalidCase(
      'reports a throwing default on the discriminant of a union that can be undefined under a non-null assertion',
      throwingDefaultOnTheDiscriminantOfANonNullAssertedUnionThatCanBeUndefined,
      { errors: [{ messageId: 'throwingDefault', line: 9 }] },
    ),
    buildInvalidCase('reports a throwing default on a comma', throwingDefaultOnACommaExpression, {
      errors: [{ messageId: 'throwingDefault', line: 11 }],
    }),
    buildInvalidCase('reports a throwing default on a value typed by a type parameter, naming the value to bind', throwingDefaultOnAGenericValue, {
      errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase(
      'reports a throwing default on a value typed by a type parameter it also keys a record by, naming the value to bind',
      throwingDefaultOnAGenericValueUsedAsAKey,
      { errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase('reports a throwing default on a property of this typed by a type parameter, naming the property to bind', throwingDefaultOnAGenericPropertyOfThis, {
      errors: [{ messageId: 'throwingDefault', line: 12, data: { discriminant: 'this.engine' } }],
    }),
    buildInvalidCase(
      'reports a throwing default on the discriminant of a union typed by a type parameter, naming the union to bind',
      throwingDefaultOnTheDiscriminantOfAGenericUnion,
      { errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'shape' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default opening with a class whose heritage assigns the value, which the never default would not run',
      throwingDefaultOpeningWithAClassWhoseHeritageAssignsTheValue,
      { errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default opening with an enum whose initializer assigns the value, which the never default would not run',
      throwingDefaultOpeningWithAnEnumWhoseInitializerAssignsTheValue,
      { errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase('reports a throwing default after every case of a branded union', throwingDefaultAfterEveryCaseOfABrandedUnion, {
      errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase(
      'reports a throwing default on an optional property after every case and undefined, naming the property to bind',
      throwingDefaultOnAnOptionalPropertyAfterEveryCaseAndUndefined,
      { errors: [{ messageId: 'throwingDefault', line: 13, data: { discriminant: 'config.engine' } }] },
    ),
    buildInvalidCase('reports a throwing default on the discriminant of this, naming this to bind', throwingDefaultOnTheDiscriminantOfThis, {
      errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'this' } }],
    }),
    buildInvalidCase('reports a throwing default on a property of this, naming the property to bind', throwingDefaultOnAPropertyOfThis, {
      errors: [{ messageId: 'throwingDefault', line: 12, data: { discriminant: 'this.engine' } }],
    }),
    buildInvalidCase('reports a throwing default on an element of a tuple, naming the element to bind', throwingDefaultOnAnElementOfATuple, {
      errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'pair[0]' } }],
    }),
    buildInvalidCase(
      'reports a throwing default on a property of a value narrowed before the switch, naming the property to bind',
      throwingDefaultOnAPropertyOfAValueNarrowedBeforeTheSwitch,
      { errors: [{ messageId: 'throwingDefault', line: 12, data: { discriminant: 'config.engine' } }] },
    ),
    buildInvalidCase('reports a throwing default opening with a function declaration', throwingDefaultOpeningWithAFunctionDeclaration, {
      errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default opening with an empty statement', throwingDefaultOpeningWithAnEmptyStatement, {
      errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase(
      'reports a throwing default opening with a const whose initializer assigns the value, which the never default would not run',
      throwingDefaultOpeningWithAConstWhoseInitializerAssignsTheValue,
      { errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default opening with a let whose initializer assigns the value, which the never default would not run',
      throwingDefaultOpeningWithALetWhoseInitializerAssignsTheValue,
      { errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'engine' } }] },
    ),
    buildInvalidCase('reports a throwing default on a nullish assignment, naming the name assigned to bind', throwingDefaultOnANullishAssignment, {
      errors: [{ messageId: 'throwingDefault', line: 12, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default on a logical-or assignment, naming the name assigned to bind', throwingDefaultOnALogicalOrAssignment, {
      errors: [{ messageId: 'throwingDefault', line: 12, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default on a logical-and assignment, naming the name assigned to bind', throwingDefaultOnALogicalAndAssignment, {
      errors: [{ messageId: 'throwingDefault', line: 14, data: { discriminant: 'engine' } }],
    }),
    // No never default binding a part of the value compiles in these; one binding a const that holds the value does.
    buildInvalidCase(
      'reports a throwing default on a double non-null assertion on a value that can be undefined, naming the value to hold in a const',
      throwingDefaultOnADoubleNonNullAssertionOnAValueThatCanBeUndefined,
      { errors: [{ messageId: 'throwingDefaultOnAValueToHoldInAConst', line: 9, data: { value: 'engine!!' } }] },
    ),
    buildInvalidCase(
      'reports a throwing default on a triple non-null assertion on a value that can be undefined, naming the value to hold in a const',
      throwingDefaultOnATripleNonNullAssertionOnAValueThatCanBeUndefined,
      { errors: [{ messageId: 'throwingDefaultOnAValueToHoldInAConst', line: 9, data: { value: 'engine!!!' } }] },
    ),
    buildInvalidCase('reports a throwing default opening with a debugger statement, naming the value to bind', throwingDefaultOpeningWithADebuggerStatement, {
      errors: [{ messageId: 'throwingDefault', line: 9, data: { discriminant: 'engine' } }],
    }),
    // Two never defaults compile here, binding the last operand or the whole comma in its parentheses; the cross-check
    // against TypeScript checks the one the message names.
    buildInvalidCase('reports a throwing default on a comma of three operands', throwingDefaultOnACommaOfThreeOperands, {
      errors: [{ messageId: 'throwingDefault', line: 11 }],
    }),
    buildInvalidCase('reports a throwing default on an element read with an aliased const key, naming the element to bind', throwingDefaultOnAnElementWithAnAliasedConstKey, {
      errors: [{ messageId: 'throwingDefault', line: 17, data: { discriminant: 'config[ENGINE]' } }],
    }),
    buildInvalidCase('reports a throwing default on an element read with an enum member key, naming the element to bind', throwingDefaultOnAnElementWithAnEnumMemberKey, {
      errors: [{ messageId: 'throwingDefault', line: 15, data: { discriminant: 'config[Key.Engine]' } }],
    }),
    buildInvalidCase("reports a throwing default on an element read with a namespace's const key, naming the element to bind", throwingDefaultOnAnElementWithANamespaceConstKey, {
      errors: [{ messageId: 'throwingDefault', line: 15, data: { discriminant: 'config[Keys.ENGINE]' } }],
    }),
    buildInvalidCase('reports a throwing default on an element read with a parameter key, naming the element to bind', throwingDefaultOnAnElementWithAParameterKey, {
      errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'config[key]' } }],
    }),
    buildInvalidCase('reports a throwing default on an element read with a let key never reassigned, naming the element to bind', throwingDefaultOnAnElementWithALetKeyNeverReassigned, {
      errors: [{ messageId: 'throwingDefault', line: 12, data: { discriminant: 'config[key]' } }],
    }),
    buildInvalidCase(
      'reports a throwing default on an element of a record read with a string key, after every case and undefined, naming the element to bind',
      throwingDefaultOnAnElementOfARecordReadWithAStringKey,
      { errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: 'table[key]' } }] },
    ),
    buildInvalidCase('reports a throwing default on a property of a comma, naming the property to bind', throwingDefaultOnAPropertyOfACommaExpression, {
      errors: [{ messageId: 'throwingDefault', line: 13, data: { discriminant: "(note('reading'), config).engine" } }],
    }),
    buildInvalidCase(
      'reports a throwing default on a non-null assertion on a parenthesised optional chain, naming the value to bind',
      throwingDefaultOnANonNullAssertionOnAParenthesisedOptionalChain,
      { errors: [{ messageId: 'throwingDefault', line: 11, data: { discriminant: '(holder?.engine)!' } }] },
    ),
    // Two never defaults compile in each of these, binding the value under its outer `!` or with it; three under
    // `((engine)!)!`. The cross-check against TypeScript checks the one the message names.
    buildInvalidCase(
      'reports a throwing default on a double non-null assertion on a parenthesised value that can be undefined',
      throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedValueThatCanBeUndefined,
      { errors: [{ messageId: 'throwingDefault', line: 9 }] },
    ),
    buildInvalidCase(
      'reports a throwing default on a non-null assertion on a parenthesised non-null assertion on a value that can be undefined',
      throwingDefaultOnANonNullAssertionOnAParenthesisedNonNullAssertionOnAValueThatCanBeUndefined,
      { errors: [{ messageId: 'throwingDefault', line: 9 }] },
    ),
    buildInvalidCase('reports a throwing default on a double non-null assertion on a parenthesised optional property', throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalProperty, {
      errors: [{ messageId: 'throwingDefault', line: 11 }],
    }),
    buildInvalidCase(
      'reports a throwing default on a double non-null assertion on a parenthesised optional property of this',
      throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalPropertyOfThis,
      { errors: [{ messageId: 'throwingDefault', line: 12 }] },
    ),
    buildInvalidCase('reports a throwing default on a double non-null assertion on a parenthesised optional chain', throwingDefaultOnADoubleNonNullAssertionOnAParenthesisedOptionalChain, {
      errors: [{ messageId: 'throwingDefault', line: 11 }],
    }),
    buildInvalidCase('reports a throwing default on the type of a union, naming the value its type is read of to bind', throwingDefaultOnTheTypeOfAUnion, {
      errors: [{ messageId: 'throwingDefault', line: 14, data: { discriminant: 'value' } }],
    }),
    buildInvalidCase('reports a throwing default on a call, naming the call to hold in a const', throwingDefaultOnACall, {
      errors: [{ messageId: 'throwingDefaultOnAValueToHoldInAConst', line: 11, data: { value: 'engineOf(path)' } }],
    }),
    buildInvalidCase('reports a throwing default on a cast, naming the cast to hold in a const', throwingDefaultOnACast, {
      errors: [{ messageId: 'throwingDefaultOnAValueToHoldInAConst', line: 9, data: { value: 'raw as Engine' } }],
    }),
    buildInvalidCase('reports a throwing default on a nullish coalescing, naming it to hold in a const', throwingDefaultOnANullishCoalescing, {
      errors: [{ messageId: 'throwingDefaultOnAValueToHoldInAConst', line: 9, data: { value: "engine ?? 'eslint'" } }],
    }),
    buildInvalidCase('reports a throwing default on the type of an unknown value, naming the type to hold in a const', throwingDefaultOnTheTypeOfAnUnknownValue, {
      errors: [{ messageId: 'throwingDefaultOnAValueToHoldInAConst', line: 12, data: { value: 'typeof value' } }],
    }),
    buildInvalidCase(
      'reports a throwing default on a non-null assertion on a value that can be undefined, naming the value to hold in a const',
      throwingDefaultOnANonNullAssertionOnAValueThatCanBeUndefined,
      { errors: [{ messageId: 'throwingDefaultOnAValueToHoldInAConst', line: 9, data: { value: 'engine!' } }] },
    ),
    buildInvalidCase('reports a throwing default on an element read with a reassigned let key, naming the element to hold in a const', throwingDefaultOnAnElementWithALetKeyReassigned, {
      errors: [{ messageId: 'throwingDefaultOnAValueToHoldInAConst', line: 13, data: { value: 'config[key]' } }],
    }),
    buildInvalidCase("reports a throwing default at a file's top level, naming the value to bind before the throw", throwingDefaultAtTheTopLevelOfAFile, {
      errors: [{ messageId: 'throwingDefaultWhereNothingReturns', line: 16, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default in a class static block, naming the value to bind before the throw', throwingDefaultInAClassStaticBlock, {
      errors: [{ messageId: 'throwingDefaultWhereNothingReturns', line: 17, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default in a setter, naming the value to bind before the throw', throwingDefaultInASetter, {
      errors: [{ messageId: 'throwingDefaultWhereNothingReturns', line: 18, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase('reports a throwing default in a function in a class static block, naming the value to bind and return', throwingDefaultInAFunctionInAClassStaticBlock, {
      errors: [{ messageId: 'throwingDefault', line: 13, data: { discriminant: 'engine' } }],
    }),
    buildInvalidCase(
      "reports a throwing default on a call at a file's top level, naming the call to hold in a const and bind before the throw",
      throwingDefaultOnACallAtTheTopLevelOfAFile,
      { errors: [{ messageId: 'throwingDefaultOnAValueToHoldInAConstWhereNothingReturns', line: 14, data: { value: 'readEngine()' } }] },
    ),
  ],
})

// With no type information there is no union to cover, so the rule has nothing to judge.
houseRuleTester.run('no-throwing-default-in-exhaustive-switch, linted without types', rule, {
  valid: [buildValidCase('stays silent where the file is linted without type information', throwingDefaultAfterEveryCase, { filename: 'file.ts' })],
  invalid: [],
})
