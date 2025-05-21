import json
import os
from sqlalchemy.orm import Session
from app.models.models import Card
from app.db.database import SessionLocal, engine
from app.models.models import Base

def import_questions(fname='questions.json'):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Get the absolute path to the JSON file in the root directory
        json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), fname)
        
        print(f"Looking for JSON file at: {json_path}")
        
        with open(json_path, 'r') as f:
            questions = json.load(f)
            
        for question in questions:
            # Convert answers to JSON string
            answers_json = json.dumps(question['answers'])
            
            # Get correct answer IDs
            correct_answers = [ans['id'] for ans in question['answers'] if ans['is_correct']]
            correct_answers_json = json.dumps(correct_answers)
            
            card = Card(
                #test_number=question['test_number'],
                #question_number=question['question_number'],
                question=question['question'],
                answers=answers_json,
                explanation=question.get('explanation', ''),
                correct_answers=correct_answers_json
            )
            
            db.add(card)
        
        db.commit()
        print(f"Successfully imported {len(questions)} questions")
        
    except Exception as e:
        print(f"Error importing questions: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    import_questions() 